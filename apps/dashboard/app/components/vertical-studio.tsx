"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDot, Cloud, CloudOff, MessageSquare, Pen, Play, Radio, ShieldCheck, Users, Video } from "lucide-react";
import {
  createCapabilityClient,
  createVerticalWorkflow,
  buildVerticalSessionReport,
  DEMO_ADAPTERS,
  FluxyChatClient,
  PLATFORM_READINESS,
  runVerticalDemoStep,
  syncWorkflowEventsToWorker,
  VERTICAL_DEMO_SEEDS,
  type VerticalId,
} from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { formatReadinessLabel } from "@/lib/readiness-display";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { useDashboardSession } from "./dashboard-session";
import { ConsolePageHeader } from "./console-page-header";
import { ConsoleProjectRoomBar } from "./console-project-room-bar";
import { ConsoleShell } from "./console-shell";
import { VerticalLiveWorkspace } from "./vertical-live-workspace";

type StudioVerticalId = "edu" | "health" | "events" | "finance" | "continuity";

export interface VerticalStudioConfig {
  id: StudioVerticalId;
  name: string;
  eyebrow: string;
  description: string;
  readiness: "Production" | "Beta" | "Preview" | "Prototype";
  journey: string[];
  metrics: Array<{ label: string; value: string }>;
  capabilities: Array<{ name: string; detail: string; status: "Ready" | "Adapter" | "Gated" }>;
  primaryAction: string;
  complianceNote: string;
  relatedLinks?: Array<{ href: string; label: string; description: string }>;
}

const VERTICAL_ID_MAP: Record<StudioVerticalId, VerticalId> = {
  edu: "edu",
  health: "health",
  events: "event",
  finance: "finance",
  continuity: "continuity",
};

const READINESS_KEY: Record<StudioVerticalId, keyof typeof PLATFORM_READINESS> = {
  edu: "edu",
  health: "health",
  events: "event",
  finance: "finance",
  continuity: "continuity",
};

function liveMetrics(
  config: VerticalStudioConfig,
  step: number,
  running: boolean,
  ws: { capability: number; server: number; polls: number },
  syncState: "local" | "synced" | "partial" | "offline",
) {
  if (syncState === "synced" && ws.capability + ws.server > 0) {
    return config.metrics.map((metric, index) => {
      if (index === 0) return { ...metric, value: String(ws.capability + ws.server) };
      if (index === 1) return { ...metric, value: "Live" };
      if (index === 2 && config.id === "edu") return { ...metric, value: String(ws.polls) };
      if (index === 2 && config.id === "events") return { ...metric, value: ws.server > 0 ? "Streaming" : metric.value };
      if (index === 2 && (config.id === "health" || config.id === "finance" || config.id === "continuity")) {
        return { ...metric, value: String(ws.capability) };
      }
      return metric;
    });
  }
  if (!running) return config.metrics;
  const progress = `${Math.min(step + 1, config.journey.length)} / ${config.journey.length}`;
  return config.metrics.map((metric, index) => {
    if (index === 0) return { ...metric, value: progress };
    if (index === 1 && step >= 2) return { ...metric, value: config.id === "edu" ? "Live" : metric.value };
    return metric;
  });
}

export function VerticalStudio({ config }: { config: VerticalStudioConfig }) {
  const verticalId = VERTICAL_ID_MAP[config.id];
  const readinessLabel = formatReadinessLabel(PLATFORM_READINESS[READINESS_KEY[config.id]].readiness);
  const seed = VERTICAL_DEMO_SEEDS[verticalId];
  const workflow = useMemo(() => createVerticalWorkflow(seed), [seed]);
  const { memberJwt, adminJwt, activeProject, lastRoom } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();
  const capabilityClient = useMemo(() => {
    if (!token) return null;
    try {
      return createCapabilityClient({ baseUrl: getPublicWorkerUrl(), token });
    } catch {
      return null;
    }
  }, [token]);
  const publishedCountRef = useRef(0);
  const [step, setStep] = useState(-1);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState(0);
  const [syncState, setSyncState] = useState<"local" | "synced" | "partial" | "offline">("offline");
  const [liveRemoteEvents, setLiveRemoteEvents] = useState(0);
  const [wsMetrics, setWsMetrics] = useState({ capability: 0, server: 0, polls: 0 });
  const [sfuJoinUrl, setSfuJoinUrl] = useState<string | null>(null);
  const [adapterNotice, setAdapterNotice] = useState<string | null>(null);

  const chatClient = useMemo(() => {
    if (!token) return null;
    try {
      return new FluxyChatClient({ baseUrl: getPublicWorkerUrl(), userId: "vertical-studio", token });
    } catch {
      return null;
    }
  }, [token]);

  const workspaceId = activeProject?.id || seed.workspaceId;
  const targetRoomId = lastRoom?.id || seed.roomId;

  useEffect(() => {
    if (!chatClient || !targetRoomId) return;
    const conn = chatClient.connectRoom(targetRoomId);
    conn.connect();
    const offCapability = conn.onCapabilityEvent(() => {
      setLiveRemoteEvents((count) => count + 1);
      setWsMetrics((m) => ({ ...m, capability: m.capability + 1 }));
      setSyncState("synced");
    });
    const offServer =
      typeof conn.onServerEvent === "function"
        ? conn.onServerEvent((ev) => {
            setLiveRemoteEvents((count) => count + 1);
            setWsMetrics((m) => ({
              ...m,
              server: m.server + 1,
              polls: ev.name.startsWith("poll.") ? m.polls + 1 : m.polls,
            }));
            setSyncState("synced");
          })
        : () => {};
    return () => {
      offCapability();
      offServer();
      conn.close();
    };
  }, [chatClient, targetRoomId]);

  const activity = workflow.activityFeed(6);
  const metrics = liveMetrics(config, step, running, wsMetrics, syncState);
  const sessionReport = running && step >= config.journey.length - 1
    ? buildVerticalSessionReport(verticalId, workflow)
    : [];

  async function advance() {
    setRunning(true);
    const nextStep = step < 0 ? 0 : (step + 1) % config.journey.length;
    runVerticalDemoStep(workflow, verticalId, nextStep);
    setStep(nextStep);
    setTick((value) => value + 1);

    if (!capabilityClient) {
      setSyncState("offline");
      return;
    }

    const newEvents = workflow.platform.events().slice(publishedCountRef.current);
    publishedCountRef.current = workflow.platform.events().length;
    const { synced, errors } = await syncWorkflowEventsToWorker(
      capabilityClient,
      newEvents.map((event) => ({
        ...event,
        roomId: targetRoomId,
        workspaceId,
      })),
      verticalId,
    );
    setSyncState(errors > 0 ? "partial" : synced > 0 ? "synced" : "local");
  }

  async function launchSfuDemo() {
    setAdapterNotice(null);
    try {
      const session = await DEMO_ADAPTERS.sfu.createSession({
        roomId: targetRoomId,
        participantId: "teacher-demo",
        role: "host",
      });
      setSfuJoinUrl(session.joinUrl);
      setAdapterNotice(`${session.provider} session ${session.sessionId} ready (demo adapter; configure your SFU vendor for production).`);
    } catch (error) {
      setAdapterNotice(error instanceof Error ? error.message : "SFU adapter failed");
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title={config.name}
        description={config.description}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              {syncState === "synced" ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}
              {syncState === "synced" ? "Worker synced" : syncState === "partial" ? "Partial sync" : syncState === "local" ? "Local only" : "Demo mode"}
            </Badge>
            {liveRemoteEvents > 0 ? (
              <Badge variant="default" className="gap-1">
                <Radio className="size-3" />
                {liveRemoteEvents} live
              </Badge>
            ) : null}
            <Badge variant="secondary">{readinessLabel}</Badge>
          </div>
        }
      />

      <ConsoleProjectRoomBar
        requireProject
        preferRoom
        hint="Vertical workflow events sync to your active room when signed in. Demo seeds apply when no room is selected."
      />

      <div className="flex flex-col gap-4" key={tick}>
        <section className="rounded-2xl border border-border bg-foreground p-5 text-background sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">{config.eyebrow}</p>
              <h2 className="mt-2 text-balance font-heading text-2xl font-semibold sm:text-3xl">One room, the complete {config.id} workflow.</h2>
              <p className="mt-3 text-pretty text-sm leading-6 text-background/70">
                This studio runs the shared vertical workflow SDK against deterministic demo seeds. Events, polls, attendance and checkpoints are real domain calls, not hidden React state.
              </p>
            </div>
            <Button type="button" onClick={advance} className="shrink-0 bg-background text-foreground hover:bg-background/90">
              <Play data-icon="inline-start" />
              {running ? "Advance demo" : config.primaryAction}
            </Button>
          </div>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl bg-background/15 sm:grid-cols-3">
            {metrics.map((metric) => (
              <div key={metric.label} className="bg-foreground p-4">
                <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs text-background/60">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Live journey</CardTitle>
              <CardDescription>Each step publishes versioned room events through the capability kernel.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2">
                {config.journey.map((item, index) => {
                  const complete = running && index < step;
                  const active = index === step;
                  return (
                    <li key={item} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>
                        {complete ? <Check className="size-4" /> : index + 1}
                      </span>
                      <span className={active ? "font-medium text-foreground" : "text-sm text-muted-foreground"}>{item}</span>
                      {active ? <Badge className="ml-auto">Active</Badge> : null}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room activity</CardTitle>
              <CardDescription>
                {workflow.platform.events().length} versioned events
                {capabilityClient ? ` · persisting to room ${targetRoomId}` : " · sign in to persist to Worker"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {(activity.length ? activity : [{ actor: "System", action: "waiting for first step", time: "Ready" }]).map((item, index) => (
                <div key={`${item.actor}-${item.action}-${index}`} className="flex gap-3">
                  <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
                    {index === 0 ? <CircleDot className="size-3.5" /> : index === 1 ? <MessageSquare className="size-3.5" /> : <Users className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm"><span className="font-medium">{item.actor}</span> {item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {(config.id === "edu" || config.id === "events" || config.id === "health" || config.id === "finance" || config.id === "continuity") && token && targetRoomId ? (
          <VerticalLiveWorkspace
            verticalId={config.id === "events" ? "events" : config.id}
            roomId={targetRoomId}
            token={token}
            adminToken={adminJwt?.trim() || undefined}
            onActivity={() => setSyncState("synced")}
          />
        ) : (config.id === "edu" || config.id === "events" || config.id === "health" || config.id === "finance" || config.id === "continuity") ? (
          <Card>
            <CardHeader>
              <CardTitle>Live workspace</CardTitle>
              <CardDescription>
                Sign in, select a project and room in the bar above to run production Worker actions (polls, stage live, compliance events) with live WebSocket fan-out.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>Capability readiness</CardTitle>
            <CardDescription>Production boundaries are visible before teams integrate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {config.capabilities.map((capability) => (
              <div key={capability.name} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{capability.name}</p>
                  <Badge variant={capability.status === "Ready" ? "default" : "outline"}>{capability.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{capability.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        {config.id === "edu" ? (
          <Card>
            <CardHeader>
              <CardTitle>Live classroom adapters</CardTitle>
              <CardDescription>Provider-neutral ports. Demo adapters only until SFU and Yjs persistence are configured.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Video className="size-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-medium">Multiparty media (SFU)</p>
                    <p className="text-sm text-muted-foreground">Creates a demo join URL without hard-coding a vendor in the domain layer.</p>
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={launchSfuDemo}>
                  Launch SFU demo
                </Button>
              </div>
              {sfuJoinUrl ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-all">{sfuJoinUrl}</p>
              ) : null}
              {adapterNotice ? <p className="text-sm text-muted-foreground">{adapterNotice}</p> : null}
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href="/collab"><Pen data-icon="inline-start" className="size-3.5" />Open whiteboard</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href="/rooms">Open class room</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {sessionReport.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Session report</CardTitle>
              <CardDescription>Aggregated from versioned room events. Same data shape a teacher or operator console would export.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {sessionReport.map((line) => (
                <div key={line.label} className="rounded-xl border border-border p-4">
                  <p className="text-2xl font-semibold tabular-nums">{line.value}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{line.label}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {config.relatedLinks && config.relatedLinks.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Connected console</CardTitle>
              <CardDescription>Jump to related products on the same room kernel.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2 sm:grid-cols-2">
              {config.relatedLinks.map((link) => (
                <Link key={link.href} href={link.href} className="rounded-xl border border-border px-4 py-3 transition hover:border-primary/30 hover:bg-muted/30">
                  <p className="font-medium">{link.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{link.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{config.complianceNote}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
            <Button asChild variant="outline">
              <Link href="/security">Review controls <ArrowRight data-icon="inline-end" /></Link>
            </Button>
            {config.id === "edu" ? (
              <Button asChild variant="outline">
                <Link href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/guides/fluxy-edu-quickstart.md" target="_blank" rel="noopener noreferrer">
                  FluxyEdu guide <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </ConsoleShell>
  );
}
