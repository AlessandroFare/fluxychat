"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Radio, Users, Vote } from "lucide-react";
import {
  createCapabilityClient,
  type CapabilityClient,
} from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import {
  checkInHybridEvent,
  createHybridEvent,
  createLiveStageEvent,
  createRoomBreakout,
  createRoomPoll,
  goLiveStageEvent,
} from "@/lib/vertical-live-client";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";

type LiveVerticalId = "edu" | "events" | "health" | "finance" | "continuity";

interface VerticalLiveWorkspaceProps {
  verticalId: LiveVerticalId;
  roomId: string;
  token: string;
  adminToken?: string;
  onActivity?: (label: string) => void;
}

interface LiveFeedItem {
  id: string;
  label: string;
  at: string;
}

function verticalCapabilityType(verticalId: LiveVerticalId): string {
  if (verticalId === "edu") return "edu.session.started";
  if (verticalId === "events") return "event.stage.live";
  if (verticalId === "health") return "health.consent.verified";
  if (verticalId === "finance") return "finance.risk.flagged";
  return "continuity.checkpoint.created";
}

export function VerticalLiveWorkspace({
  verticalId,
  roomId,
  token,
  adminToken,
  onActivity,
}: VerticalLiveWorkspaceProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feed, setFeed] = useState<LiveFeedItem[]>([]);
  const [pollTitle, setPollTitle] = useState("Quick knowledge check");
  const [breakoutName, setBreakoutName] = useState("Group A");
  const [stageTitle, setStageTitle] = useState("Main stage keynote");
  const [hybridEventId, setHybridEventId] = useState<string | null>(null);
  const [liveEventId, setLiveEventId] = useState<string | null>(null);
  const [whipUrl, setWhipUrl] = useState<string | null>(null);

  const capabilityClient: CapabilityClient | null = token
    ? createCapabilityClient({ baseUrl: getPublicWorkerUrl(), token })
    : null;

  const pushFeed = useCallback((label: string) => {
    const item = { id: crypto.randomUUID(), label, at: new Date().toLocaleTimeString() };
    setFeed((prev) => [item, ...prev].slice(0, 8));
    onActivity?.(label);
  }, [onActivity]);

  useEffect(() => {
    setHybridEventId(null);
    setLiveEventId(null);
    setWhipUrl(null);
    setFeed([]);
    setNotice(null);
    setError(null);
  }, [roomId, verticalId]);

  async function publishCapability(extra?: Record<string, unknown>) {
    if (!capabilityClient) throw new Error("Sign in to publish capability events");
    const type = verticalCapabilityType(verticalId);
    const result = await capabilityClient.publish({
      roomId,
      vertical: verticalId === "events" ? "event" : verticalId,
      type,
      actor: { id: "vertical-studio", type: "user", role: "admin" },
      idempotencyKey: `${type}-${roomId}-${Date.now()}`,
      payload: extra ?? {},
    });
    if (!result.ok) throw new Error(result.error || "publish_failed");
    pushFeed(`Capability · ${type}`);
  }

  async function runAction(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  const showEdu = verticalId === "edu";
  const showEvents = verticalId === "events";
  const showCompliance = verticalId === "health" || verticalId === "finance" || verticalId === "continuity";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radio className="size-4" aria-hidden />
          Live workspace
        </CardTitle>
        <CardDescription>
          Production Worker calls on room <span className="font-mono text-xs">{roomId}</span> — polls, breakouts, stage, hybrid check-in and capability events fan out on the room WebSocket.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error ? <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</p> : null}
        {notice ? <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{notice}</p> : null}

        {showEdu ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Vote className="size-4" aria-hidden />
                <p className="font-medium">Launch poll</p>
              </div>
              <Input className="mt-3" value={pollTitle} onChange={(e) => setPollTitle(e.target.value)} placeholder="Poll title" />
              <Button
                type="button"
                size="sm"
                className="mt-3"
                disabled={!!busy}
                onClick={() => void runAction("poll", async () => {
                  const result = await createRoomPoll(token, {
                    roomId,
                    title: pollTitle,
                    options: ["A", "B", "C", "D"],
                  });
                  if (!result.ok) throw new Error(result.error || "poll_failed");
                  pushFeed(`Poll created · ${result.poll?.id ?? "ok"}`);
                  setNotice("Poll is open — votes fan out as poll.* server events.");
                })}
              >
                {busy === "poll" ? <Loader2 className="size-3 animate-spin" /> : null}
                Create poll
              </Button>
            </div>
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center gap-2">
                <Users className="size-4" aria-hidden />
                <p className="font-medium">Breakout group</p>
              </div>
              <Input className="mt-3" value={breakoutName} onChange={(e) => setBreakoutName(e.target.value)} placeholder="Breakout name" />
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-3"
                disabled={!!busy}
                onClick={() => void runAction("breakout", async () => {
                  const result = await createRoomBreakout(token, roomId, breakoutName);
                  if (!result.ok) throw new Error(result.error || "breakout_failed");
                  pushFeed(`Breakout · ${result.breakout?.name ?? breakoutName}`);
                  setNotice("Breakout announced via edu.breakout.created server event.");
                })}
              >
                {busy === "breakout" ? <Loader2 className="size-3 animate-spin" /> : null}
                Open breakout
              </Button>
            </div>
          </div>
        ) : null}

        {showEvents ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium">Main stage (FluxyStream)</p>
              <Input className="mt-3" value={stageTitle} onChange={(e) => setStageTitle(e.target.value)} placeholder="Stage title" />
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !adminToken}
                  onClick={() => void runAction("stage-create", async () => {
                    if (!adminToken) throw new Error("Admin JWT required for live stage");
                    const result = await createLiveStageEvent(adminToken, { roomId, title: stageTitle });
                    if (!result.event?.id) throw new Error(result.error || "stage_create_failed");
                    setLiveEventId(result.event.id);
                    pushFeed(`Stage scheduled · ${result.event.id}`);
                    setNotice("Live event created — go live to auto-provision WHIP/RTMPS when Cloudflare Stream is configured.");
                  })}
                >
                  Schedule stage
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="default"
                  disabled={!!busy || !adminToken || !liveEventId}
                  onClick={() => void runAction("stage-live", async () => {
                    if (!adminToken || !liveEventId) throw new Error("Create a stage first");
                    const result = await goLiveStageEvent(adminToken, liveEventId);
                    if (!result.event) throw new Error(result.error || "go_live_failed");
                    setWhipUrl(result.event.whipUrl ?? null);
                    pushFeed("Stage live · live.event_live");
                    setNotice(result.event.whipUrl
                      ? `WHIP ingest ready. HLS: ${result.event.playbackHls ?? "pending"}`
                      : "Stage is live — configure CLOUDFLARE_STREAM_* on Worker for WHIP auto-provision.");
                  })}
                >
                  Go live
                </Button>
              </div>
              {whipUrl ? <p className="mt-2 font-mono text-xs break-all text-muted-foreground">WHIP: {whipUrl}</p> : null}
            </div>
            <div className="rounded-xl border border-border p-4">
              <p className="font-medium">Hybrid check-in</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!!busy || !adminToken}
                  onClick={() => void runAction("hybrid", async () => {
                    if (!adminToken) throw new Error("Admin JWT required for hybrid events");
                    const ev = await createHybridEvent(adminToken, { roomId, name: stageTitle, mode: "hybrid" });
                    setHybridEventId(ev.id);
                    pushFeed(`Hybrid event · ${ev.qrCode ?? ev.id}`);
                    setNotice("Hybrid event created — remote attendees can check in next.");
                  })}
                >
                  Create hybrid event
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !hybridEventId}
                  onClick={() => void runAction("checkin", async () => {
                    if (!hybridEventId) throw new Error("Create hybrid event first");
                    await checkInHybridEvent(token, hybridEventId, "remote");
                    pushFeed("Check-in · event.hybrid.checkin");
                    setNotice("Remote check-in recorded and fan-out to room.");
                  })}
                >
                  Remote check-in
                </Button>
              </div>
            </div>
          </div>
        ) : null}

        {showCompliance ? (
          <div className="rounded-xl border border-border p-4">
            <p className="font-medium">Compliance signal</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish a versioned capability event for audit trails — {verticalCapabilityType(verticalId)}.
            </p>
            <Button
              type="button"
              size="sm"
              className="mt-3"
              variant="outline"
              disabled={!!busy}
              onClick={() => void runAction("compliance", async () => {
                await publishCapability(
                  verticalId === "health"
                    ? { scope: "treatment", verified: true }
                    : verticalId === "finance"
                      ? { desk: "equities", session: "open" }
                      : { deviceClass: "mobile", trustScore: 0.92 },
                );
                setNotice("Capability event persisted and broadcast on room WS.");
              })}
            >
              Publish compliance event
            </Button>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {(showEdu || showEvents) ? (
            <Button
              type="button"
              size="sm"
              disabled={!!busy}
              onClick={() => void runAction("session", async () => {
                await publishCapability(
                  verticalId === "events" ? { stage: "keynote" } : { learnersPresent: 28 },
                );
                setNotice(`Published ${verticalCapabilityType(verticalId)} to room.`);
              })}
            >
              {busy === "session" ? <Loader2 className="size-3 animate-spin" /> : null}
              {verticalId === "events" ? "Announce stage live" : "Start live session"}
            </Button>
          ) : null}
        </div>

        {feed.length > 0 ? (
          <div className="rounded-xl border border-border p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent actions</p>
            <ul className="mt-2 flex flex-col gap-2">
              {feed.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>{item.label}</span>
                  <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{item.at}</Badge>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
