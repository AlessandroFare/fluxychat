"use client";

import { useMemo, useState } from "react";
import { ArrowRightLeft, Brain, GitBranch, Network, TestTubes } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import {
  createCrossChannelContinuity,
  createJourneyMapping,
  createAbTestingEngine,
  createA2AClient,
  FluxyChatClient,
  createCustomerMemoryClient,
  createWorkerAgentTaskClient,
} from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { useDashboardSession } from "../components/dashboard-session";

type TabId = "continuity" | "journey" | "abtesting" | "a2a" | "memory";

const TABS: { id: TabId; label: string; icon: typeof ArrowRightLeft }[] = [
  { id: "continuity", label: "Cross-Channel", icon: ArrowRightLeft },
  { id: "journey", label: "Journey Map", icon: GitBranch },
  { id: "memory", label: "Memory Graph", icon: Brain },
  { id: "abtesting", label: "A/B Testing", icon: TestTubes },
  { id: "a2a", label: "A2A Protocol", icon: Network },
];

export default function CrossChannelPage() {
  const [tab, setTab] = useState<TabId>("continuity");
  const { memberJwt, adminJwt, lastRoom } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();
  const chatClient = useMemo(() => {
    if (!token) return null;
    return new FluxyChatClient({
      baseUrl: getPublicWorkerUrl(),
      userId: "console-demo",
      token,
    });
  }, [token]);
  const memoryClient = useMemo(
    () => (chatClient ? createCustomerMemoryClient(chatClient) : null),
    [chatClient],
  );
  const taskClient = useMemo(
    () => (chatClient ? createWorkerAgentTaskClient(chatClient) : null),
    [chatClient],
  );
  const [ccc] = useState(() => createCrossChannelContinuity());
  const [jm] = useState(() => createJourneyMapping());
  const [ab] = useState(() => createAbTestingEngine());
  const [a2a] = useState(() => createA2AClient());
  const [sessionLog, setSessionLog] = useState<string[]>([]);
  const [journeyLog, setJourneyLog] = useState<string[]>([]);
  const [abLog, setAbLog] = useState<string[]>([]);
  const [a2aLog, setA2aLog] = useState<string[]>([]);
  const [memoryLog, setMemoryLog] = useState<string[]>([]);
  const [activeChannel, setActiveChannel] = useState<"web" | "mobile" | "voice" | null>(null);
  const [linkedChannels, setLinkedChannels] = useState<string[]>([]);
  const [journeyPaths, setJourneyPaths] = useState<Array<{ from: string; to: string; count: number }>>([]);

  const TabContent = {
    continuity: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Unify user sessions across web, mobile, voice, bot, email, and SMS.</p>
        <div className="flex flex-wrap gap-2">
          {(["web", "mobile", "voice"] as const).map((ch) => (
            <span
              key={ch}
              className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                activeChannel === ch
                  ? "bg-primary text-primary-foreground"
                  : linkedChannels.includes(ch)
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {ch}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
            setActiveChannel("web");
            setLinkedChannels(["web"]);
            setSessionLog((p) => [`Session ${s.id} created (web)`, ...p]);
          }}>Create web session</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const s = ccc.getSessionByUser("user-1");
            if (s) {
              ccc.linkIdentity(s.id, { channel: "mobile", externalId: "mobile-1" });
              setLinkedChannels((prev) => [...new Set([...prev, "mobile"])]);
              setSessionLog((p) => [`Linked mobile identity to ${s.id}`, ...p]);
            }
          }}>Link mobile</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const s = ccc.getSessionByUser("user-1");
            if (!s) return;
            try {
              ccc.switchChannel(s.id, "mobile");
              setActiveChannel("mobile");
              setSessionLog((p) => ["Switched to mobile channel", ...p]);
            } catch (e: unknown) {
              setSessionLog((p) => [e instanceof Error ? e.message : "switch failed", ...p]);
            }
          }}>Switch to mobile</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const s = ccc.getSessionByUser("user-1");
            if (s) {
              ccc.linkIdentity(s.id, { channel: "voice", externalId: "voice-1" });
              setLinkedChannels((prev) => [...new Set([...prev, "voice"])]);
              setSessionLog((p) => [`Linked voice identity to ${s.id}`, ...p]);
            }
          }}>Link voice</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const s = ccc.getSessionByUser("user-1");
            if (s) {
              const linked = ccc.getLinkedSessions({ channel: "web", externalId: "web-1" });
              setSessionLog((p) => [`Linked sessions: ${linked.length}`, ...p]);
            }
          }}>Check linked</Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {sessionLog.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
        </div>
      </div>
    ),
    journey: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Track customer steps across channels and visualize transition paths.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            jm.recordStep("user-1", { channel: "web", action: "view", timestamp: Date.now(), durationMs: 500, metadata: {} });
            setJourneyLog((p) => ["Recorded web view step", ...p]);
          }}>Record web view</Button>
          <Button size="sm" variant="outline" onClick={() => {
            jm.recordStep("user-1", { channel: "mobile", action: "purchase", timestamp: Date.now(), metadata: {} });
            setJourneyLog((p) => ["Recorded mobile purchase step", ...p]);
          }}>Record purchase</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const paths = jm.getPaths();
            setJourneyPaths(paths);
            setJourneyLog((p) => [`Paths: ${paths.length > 0 ? paths.map((path) => `${path.from}→${path.to}(${path.count})`).join(", ") : "none"}`, ...p]);
          }}>Show paths</Button>
        </div>
        {journeyPaths.length > 0 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {journeyPaths.map((path) => (
              <div key={`${path.from}-${path.to}`} className="flex items-center gap-2 rounded-lg border border-border bg-card p-3 text-sm">
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs capitalize">{path.from}</span>
                <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs capitalize text-primary">{path.to}</span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">{path.count}×</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {journeyLog.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
        </div>
      </div>
    ),
    abtesting: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Create A/B tests, assign variants, track conversions.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            const t = ab.createTest({
              name: `Theme Test #${Date.now()}`,
              variants: [
                { id: "light", name: "Light", config: { theme: "light" }, trafficPercent: 50 },
                { id: "dark", name: "Dark", config: { theme: "dark" }, trafficPercent: 50 },
              ],
              metric: "click_rate", minSampleSize: 100,
            });
            ab.startTest(t.id);
            setAbLog((p) => [`Test "${t.id}" created & started`, ...p]);
          }}>Create A/B test</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const tests = ab.listTests().filter((t) => t.status === "running");
            if (tests.length === 0) return;
            const v = ab.assignVariant(tests[0].id);
            ab.recordExposure(tests[0].id, v.id);
            setAbLog((p) => [`Assigned variant "${v.id}" (${v.name})`, ...p]);
          }}>Assign variant</Button>
          <Button size="sm" variant="outline" onClick={() => {
            const tests = ab.listTests();
            if (tests.length === 0) return;
            const results = ab.getResults(tests[tests.length - 1].id);
            setAbLog((p) => [`Results: ${results.map(r => `${r.variantName}=${(r.conversionRate * 100).toFixed(0)}%`).join(", ")}`, ...p]);
          }}>Show results</Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {abLog.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
        </div>
      </div>
    ),
    a2a: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Agent-to-agent protocol (Google A2A v1.0). Send tasks between agents.</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => {
            const t = a2a.createTask({ title: "Translate", input: { text: "hello" } });
            a2a.acknowledgeTask(t.id);
            a2a.completeTask(t.id, { translated: "bonjour" });
            setA2aLog((p) => [`Task "${t.id}": created → working → completed`, ...p]);
          }}>Run agent task</Button>
          <Button size="sm" variant="outline" onClick={async () => {
            if (!taskClient || !lastRoom?.id) {
              setA2aLog((p) => ["Sign in + pick a room to persist long-horizon tasks on Worker", ...p]);
              return;
            }
            try {
              const { task } = await taskClient.submit({
                roomId: lastRoom.id,
                fromAgentId: "agent-alpha",
                toAgentId: "agent-beta",
                input: "Follow up on loan application in 7 days",
                idempotencyKey: `demo-${Date.now()}`,
              });
              setA2aLog((p) => [`Worker task ${task.id} (${task.status})`, ...p]);
            } catch (err) {
              setA2aLog((p) => [err instanceof Error ? err.message : "task submit failed", ...p]);
            }
          }}>Submit Worker task</Button>
          <Button size="sm" variant="outline" onClick={() => {
            a2a.sendEnvelope({ source: "agent-alpha", target: "agent-beta", taskId: "demo", status: "pending", extensions: {} });
            const msgs = a2a.receiveEnvelope("agent-beta");
            setA2aLog((p) => [`Sent envelope → received by beta: ${msgs.length}`, ...p]);
          }}>Send A2A message</Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {a2aLog.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
        </div>
      </div>
    ),
    memory: (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Unified customer memory: CDP profile + events + room knowledge graph nodes.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            disabled={!memoryClient}
            onClick={async () => {
              if (!memoryClient) return;
              try {
                const graph = await memoryClient.getGraph({
                  externalId: "user-1",
                  roomId: lastRoom?.id,
                });
                setMemoryLog((p) => [
                  `Nodes: ${graph.nodes.length}, edges: ${graph.edges.length}, events: ${graph.recentEvents.length}`,
                  ...p,
                ]);
              } catch (err) {
                setMemoryLog((p) => [err instanceof Error ? err.message : "memory fetch failed", ...p]);
              }
            }}
          >
            Load memory graph
          </Button>
        </div>
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
          {memoryLog.map((e, i) => <p key={i} className="text-xs text-muted-foreground">{e}</p>)}
          {!memoryClient ? (
            <p className="text-xs text-muted-foreground">Sign in to query Worker-backed CDP + KG APIs.</p>
          ) : null}
        </div>
      </div>
    ),
  };

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Cross-Channel & Multi-Agent"
        description="Cross-channel continuity, journey mapping, A/B testing, and A2A protocol — SDK-powered interactive demos."
      />

      <ConsoleProjectRoomBar
        requireProject
        preferRoom
        hint="Memory graph and A2A task APIs use your Worker when signed in; continuity and journey tabs exercise the SDK locally."
      />

      <div role="tablist" className="mt-6 flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className="-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ borderColor: tab === t.id ? "var(--fluxy-cta-color)" : "transparent", color: tab === t.id ? "var(--foreground)" : "var(--muted-foreground)" }}>
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-6">{TabContent[tab]}</div>
    </ConsoleShell>
  );
}
