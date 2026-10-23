"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cursor } from "@fluxy-chat/ui";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { cn } from "@/lib/utils";

type BuildExample = {
  id: string;
  title: string;
  time: string;
  command: string;
  snippet: string;
  preview: "cursors" | "war" | "shared" | "iot" | "deal";
};

const EXAMPLES: BuildExample[] = [
  {
    id: "cursors",
    title: "Live cursors",
    time: "about 10 minutes",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors",
    snippet: `const { cursors, publish } = useLiveCursors({ roomId });

function onMove(e: PointerEvent) {
  publish({ x: e.clientX, y: e.clientY, color: "#ff6a1a" });
}
// Render: cursors.map((c) => <Cursor cursor={c} />)`,
    preview: "cursors",
  },
  {
    id: "war",
    title: "Agent war room",
    time: "an afternoon",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room",
    snippet: `const { messages, invokeAgent } = useChat({ roomId });

await invokeAgent("Summarize the last 20 messages", { agentId });`,
    preview: "war",
  },
  {
    id: "iot",
    title: "Device panel",
    time: "an afternoon",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel",
    snippet: `await fetch(\`\${worker}/iot/devices/\${id}/readings\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${jwt}\` },
  body: JSON.stringify({ sensor: "temp", value: 21.4, unit: "C" }),
});`,
    preview: "iot",
  },
  {
    id: "deal",
    title: "Deal room",
    time: "a day",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-deal --example deal-room",
    snippet: `sendMessage("Counsel only: redlines on section 4.", null, undefined, {
  visibility: "whisper",
  visibleTo: [selfUserId],
});
await invokeAgent("Summarize open decisions.", { agentId });`,
    preview: "deal",
  },
];

const liveCursorsExample = EXAMPLES[0];
const warRoomExample = EXAMPLES[1];
const dealRoomExample = EXAMPLES[3];

export const HOMEPAGE_EXAMPLES: BuildExample[] = [
  liveCursorsExample,
  warRoomExample,
  {
    id: "shared",
    title: "Shared AI room",
    time: "about 15 minutes",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-room --example shared-ai-room",
    snippet: `const { messages, invokeAgent, stopAgentStream } = useChat({
  roomId,
  publishableKey,
});

await invokeAgent("Summarize open decisions", { agentId });`,
    preview: "shared",
  },
  dealRoomExample,
];

/**
 * Sam walks a fixed route with human pauses and clicks; the visitor drives the
 * second cursor. Both render through the spring-smoothed Cursor from
 * @fluxy-chat/ui — the same component the `live-cursors` template ships.
 */
const SAM_ROUTE: Array<{ x: number; y: number; click?: boolean }> = [
  { x: 0.72, y: 0.26 },
  { x: 0.58, y: 0.62, click: true },
  { x: 0.26, y: 0.4 },
  { x: 0.42, y: 0.84 },
  { x: 0.18, y: 0.66, click: true },
  { x: 0.8, y: 0.5 },
];

function CursorsPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [you, setYou] = useState({ x: 88, y: 72 });
  const [sam, setSam] = useState({ x: 210, y: 118 });
  const [youActive, setYouActive] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number; color: string }>>(
    [],
  );
  const rippleId = useRef(0);

  const spawnRipple = useCallback((x: number, y: number, color: string) => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = ++rippleId.current;
    setRipples((prev) => [...prev.slice(-3), { id, x, y, color }]);
    window.setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 700);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    let frame = 0;
    let routeIndex = -1;
    let phase: "move" | "dwell" = "dwell";
    let phaseEndsAt = 0;
    let last = 0;
    let target = { x: 210, y: 118, click: false };
    const pos = { x: 210, y: 118 };

    function startMove(index: number) {
      const rect = wrapRef.current?.getBoundingClientRect();
      const wp = SAM_ROUTE[index % SAM_ROUTE.length];
      target = rect
        ? {
            x: Math.min(Math.max(28, wp.x * rect.width), Math.max(28, rect.width - 56)),
            y: Math.min(Math.max(20, wp.y * rect.height), Math.max(20, rect.height - 44)),
            click: Boolean(wp.click),
          }
        : { x: target.x, y: target.y, click: false };
      phase = "move";
    }

    function tick(now: number) {
      const dt = last ? Math.min((now - last) / 1000, 0.05) : 0.016;
      last = now;
      if (phase === "dwell" && now >= phaseEndsAt) startMove((routeIndex += 1));
      const k = Math.min(1, dt * 3.4);
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      if (
        phase === "move" &&
        Math.abs(target.x - pos.x) < 1.5 &&
        Math.abs(target.y - pos.y) < 1.5
      ) {
        phase = "dwell";
        phaseEndsAt = now + 700 + Math.random() * 900;
        if (target.click) spawnRipple(target.x, target.y, "#38bdf8");
      }
      setSam({ x: pos.x, y: pos.y });
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [spawnRipple]);

  function moveTo(clientX: number, clientY: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    setYou({
      x: Math.min(Math.max(10, clientX - rect.left), rect.width - 10),
      y: Math.min(Math.max(10, clientY - rect.top), rect.height - 10),
    });
  }

  return (
    <div
      ref={wrapRef}
      className="relative h-56 cursor-none touch-none overflow-hidden rounded-xl bg-zinc-950 sm:h-72"
      onPointerEnter={() => setYouActive(true)}
      onPointerMove={(e) => {
        setYouActive(true);
        moveTo(e.clientX, e.clientY);
      }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        setYouActive(true);
        moveTo(e.clientX, e.clientY);
        const rect = wrapRef.current?.getBoundingClientRect();
        if (rect) spawnRipple(e.clientX - rect.left, e.clientY - rect.top, "#ff6a1a");
      }}
      onPointerLeave={() => setYouActive(false)}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(39 39 42 / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(39 39 42 / 0.7) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute h-3 w-3 rounded-full border-2"
          style={{
            left: r.x - 6,
            top: r.y - 6,
            borderColor: r.color,
            animation: "rt-ping 700ms ease-out forwards",
          }}
        />
      ))}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{ opacity: youActive ? 1 : 0 }}
      >
        <Cursor cursor={{ userId: "you", x: you.x, y: you.y, color: "#ff6a1a", label: "You" }} />
      </div>
      <Cursor cursor={{ userId: "sam", x: sam.x, y: sam.y, color: "#38bdf8", label: "Sam" }} />
      <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-[11px] text-zinc-500">
        Move your pointer here. The orange cursor is you; Sam is in the same room, live.
      </p>
    </div>
  );
}

const WAR_PROMPTS = [
  {
    chip: "Logs",
    ask: "Summarize the last 20 messages",
    reply: "3 errors in the last hour, all on the checkout webhook.\nRetry queue drained at 09:41. No open incidents.",
  },
  {
    chip: "Deploys",
    ask: "What changed in deploys?",
    reply: "Two deploys since 09:00: billing-worker v214, dashboard v88.\nErrors start where v214 lands; retry cap moved from 2 to 5.",
  },
  {
    chip: "Incident update",
    ask: "Draft an incident update",
    reply: "Update 09:45, resolved: elevated webhook errors 09:12 to 09:41.\nNo customer-visible impact. Watch only, no page.",
  },
];

function WarPreview() {
  const [lines, setLines] = useState([
    { id: "1", who: "alice", text: "Check the logs from the last hour" },
  ]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");

  async function invoke(prompt?: string) {
    if (busy) return;
    const ask = (prompt ?? draft).trim() || WAR_PROMPTS[0].ask;
    const reply = WAR_PROMPTS.find((p) => p.ask === ask)?.reply ?? WAR_PROMPTS[0].reply;
    setBusy(true);
    setDraft("");
    setLines((prev) => [
      ...prev,
      { id: `${Date.now()}-you`, who: "you", text: ask },
      { id: `${Date.now()}-a`, who: "agent", text: "" },
    ]);
    for (let i = 1; i <= reply.length; i += 1) {
      await new Promise((r) => setTimeout(r, 11));
      const slice = reply.slice(0, i);
      setLines((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.who === "agent") next[next.length - 1] = { ...last, text: slice };
        return next;
      });
    }
    setBusy(false);
  }

  return (
    <div className="flex h-56 flex-col rounded-xl bg-zinc-950 sm:h-72">
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-left text-[12px]">
        {lines.map((line, index) => (
          <div
            key={line.id}
            className={cn(
              "max-w-[90%] whitespace-pre-line rounded-lg px-2.5 py-1.5",
              line.who === "you" && "ml-auto bg-zinc-100 text-zinc-900",
              line.who === "alice" && "bg-zinc-800 text-zinc-200",
              line.who === "agent" && "bg-orange-500/20 text-orange-100",
            )}
          >
            {line.who === "agent" ? (
              <>
                <span className="text-orange-300/80">@ops </span>
                {line.text}
                {busy && index === lines.length - 1 ? (
                  <span className="ml-0.5 animate-pulse motion-reduce:animate-none">▍</span>
                ) : null}
              </>
            ) : (
              line.text
            )}
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 p-2">
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {WAR_PROMPTS.map((p) => (
            <button
              key={p.chip}
              type="button"
              disabled={busy}
              onClick={() => void invoke(p.ask)}
              className="rounded-full border border-white/10 bg-zinc-900 px-2.5 py-1 text-[10px] text-zinc-300 transition hover:border-[#ff6a1a]/50 hover:text-white disabled:opacity-40"
            >
              {p.chip}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void invoke();
              }
            }}
            placeholder="Ask @ops, or pick a prompt"
            className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#ff6a1a]/60"
            aria-label="Ask the room agent"
          />
          <button
            type="button"
            onClick={() => void invoke()}
            disabled={busy}
            className="shrink-0 rounded-md bg-[#ff6a1a] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {busy ? "Running" : "Invoke"}
          </button>
        </div>
      </div>
    </div>
  );
}

const SHARED_REPLY =
  "Open decisions:\n1. Pricing page copy: owner Ada, due today.\n2. Launch date: owner you, still open.\nBlocker cleared: analytics cutover shipped 40 minutes ago.";

type SharedLine = { id: string; who: "ada" | "you" | "agent"; text: string; stopped?: boolean };

function SharedRoomPreview() {
  const [messages, setMessages] = useState<SharedLine[]>([
    { id: "a1", who: "ada", text: "Draft is in #pricing. Open question on the plan table." },
  ]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const stopRef = useRef(false);

  async function invoke() {
    if (busy) return;
    const ask = draft.trim() || "Summarize open decisions";
    setDraft("");
    stopRef.current = false;
    setBusy(true);
    const agentId = `${Date.now()}-a`;
    setMessages((prev) => [
      ...prev,
      { id: `${Date.now()}-you`, who: "you", text: ask },
      { id: agentId, who: "agent", text: "" },
    ]);
    for (let i = 1; i <= SHARED_REPLY.length; i += 1) {
      if (stopRef.current) break;
      await new Promise((r) => setTimeout(r, 11));
      const slice = SHARED_REPLY.slice(0, i);
      setMessages((prev) => prev.map((m) => (m.id === agentId ? { ...m, text: slice } : m)));
    }
    setMessages((prev) =>
      prev.map((m) => (m.id === agentId ? { ...m, stopped: stopRef.current } : m)),
    );
    setBusy(false);
  }

  return (
    <div className="flex h-56 flex-col rounded-xl bg-zinc-950 sm:h-72">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-white/10 px-3 py-1.5 text-[10px] text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> you · guest
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> ada
        </span>
        <span className="flex items-center gap-1">
          <span className={cn("h-1.5 w-1.5 rounded-full bg-orange-400", busy && "animate-pulse")} />{" "}
          @ops
        </span>
        <span className="ml-auto font-mono">publishable key · no account</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-left text-[12px]">
        {messages.map((m, index) => (
          <div
            key={m.id}
            className={cn(
              "max-w-[90%] whitespace-pre-line rounded-lg px-2.5 py-1.5",
              m.who === "you" && "ml-auto bg-zinc-100 text-zinc-900",
              m.who === "ada" && "bg-zinc-800 text-zinc-200",
              m.who === "agent" && "bg-orange-500/20 text-orange-100",
            )}
          >
            {m.who === "agent" ? (
              <>
                <span className="text-orange-300/80">@ops </span>
                {m.text}
                {busy && index === messages.length - 1 ? (
                  <span className="ml-0.5 animate-pulse motion-reduce:animate-none">▍</span>
                ) : null}
                {m.stopped ? (
                  <span className="mt-1 block text-[10px] text-orange-100/70">
                    stream stopped · partial answer kept
                  </span>
                ) : null}
              </>
            ) : (
              m.text
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-white/10 p-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void invoke();
            }
          }}
          placeholder="Ask @ops: summarize open decisions"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 outline-none focus:border-[#ff6a1a]/60"
          aria-label="Ask the room agent"
        />
        <button
          type="button"
          onClick={() => {
            if (busy) stopRef.current = true;
            else void invoke();
          }}
          className={cn(
            "shrink-0 rounded-md px-3 py-1.5 text-xs font-medium text-white",
            busy ? "border border-white/20 bg-white/10" : "bg-[#ff6a1a]",
          )}
        >
          {busy ? "Stop" : "Invoke"}
        </button>
      </div>
    </div>
  );
}

function IoTPreview() {
  const [temp, setTemp] = useState(21.4);
  const [selected, setSelected] = useState<"bay" | "pump" | "amp" | "health">("bay");
  const [health, setHealth] = useState(92);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTemp((t) => Math.round((t + (Math.random() - 0.48) * 0.15) * 10) / 10);
      setHealth((h) => Math.max(84, Math.min(99, h + (Math.random() > 0.5 ? 1 : -1))));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  const tiles = [
    { id: "bay" as const, label: "Bay 4", value: `${temp.toFixed(1)} C` },
    { id: "pump" as const, label: "Pump", value: "ok" },
    { id: "amp" as const, label: "Draw", value: "0.12 A" },
    { id: "health" as const, label: "Health", value: String(health) },
  ];

  return (
    <div className="flex h-56 flex-col gap-2 rounded-xl bg-zinc-950 p-3 sm:h-72">
      <div className="grid flex-1 grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            type="button"
            onClick={() => setSelected(tile.id)}
            className={cn(
              "flex flex-col items-center justify-center rounded-lg border font-mono text-xs transition",
              selected === tile.id
                ? "border-[#ff6a1a]/70 bg-zinc-800 text-white"
                : "border-white/5 bg-zinc-900 text-zinc-200 hover:border-white/20",
            )}
          >
            <span className="text-[10px] uppercase tracking-wide text-zinc-500">{tile.label}</span>
            <span className="mt-1 text-sm">{tile.value}</span>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-500">
        {selected === "bay" && "POST /iot/devices/bay-4/readings  ·  room fans out iot.reading"}
        {selected === "pump" && "Shadow reported=desired. No trend alerts."}
        {selected === "amp" && "Current draw is flat. Rule: warn above 0.4 A."}
        {selected === "health" && "GET /iot/devices/bay-4/health scores the last 50 samples."}
      </p>
    </div>
  );
}

function DealPreview() {
  const [acks, setAcks] = useState({ buyer: false, counsel: false });
  const [whisperOn, setWhisperOn] = useState(false);
  const ready = acks.buyer && acks.counsel;

  function reset() {
    setAcks({ buyer: false, counsel: false });
    setWhisperOn(false);
  }

  return (
    <div className="flex h-56 flex-col gap-2 rounded-xl bg-zinc-950 p-2 text-left text-[11px] text-zinc-200 sm:h-72 sm:p-3 sm:text-[12px]">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        Preview · two seats. Whisper is filtered on the Worker, not CSS.
      </p>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2">
        <div className="flex flex-col rounded-lg border border-white/10 bg-zinc-900 p-2">
          <p className="font-medium text-white">buyer</p>
          <p className="mt-1 text-zinc-400">Approve term sheet?</p>
          <p className="mt-2 text-zinc-500">
            {whisperOn ? "No counsel note on this tab." : "Open counsel, send a whisper."}
          </p>
          <button
            type="button"
            onClick={() => setAcks((a) => ({ ...a, buyer: !a.buyer }))}
            className={cn(
              "mt-auto rounded-md border px-2 py-1.5 text-left",
              acks.buyer ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-zinc-950",
            )}
          >
            Ack · {acks.buyer ? "yes" : "pending"}
          </button>
        </div>
        <div className="flex flex-col rounded-lg border border-white/10 bg-zinc-900 p-2">
          <p className="font-medium text-white">
            counsel{" "}
            <span className="font-mono text-[10px] font-normal text-zinc-500">?seat=counsel</span>
          </p>
          <p className="mt-1 text-zinc-400">Approve term sheet?</p>
          {whisperOn ? (
            <>
              <p className="mt-2 rounded bg-orange-500/15 px-1.5 py-1 text-orange-100">
                Counsel only: redlines on section 4.
              </p>
              <p className="mt-1 text-[10px] text-zinc-500">Delivered to 1 of 2 seats.</p>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setWhisperOn(true)}
              className="mt-2 rounded-md border border-white/10 bg-zinc-950 px-2 py-1.5 text-left"
            >
              Counsel note
            </button>
          )}
          <button
            type="button"
            onClick={() => setAcks((a) => ({ ...a, counsel: !a.counsel }))}
            className={cn(
              "mt-auto rounded-md border px-2 py-1.5 text-left",
              acks.counsel ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-zinc-950",
            )}
          >
            Ack · {acks.counsel ? "yes" : "pending"}
          </button>
        </div>
      </div>
      {ready ? (
        <div className="rounded-lg border border-orange-400/30 bg-orange-500/10 px-2 py-1.5 text-orange-100">
          <span className="text-[10px] uppercase tracking-wide text-orange-200/70">@deal-agent</span>
          <p className="mt-0.5 text-[11px]">
            Summary for the feed: both seats approved the term sheet. Counsel redline on section 4
            attached to the trace.
          </p>
        </div>
      ) : null}
      <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500">
        <p>
          {ready
            ? "Quorum met. Traces stay in a feed, not chat."
            : "Ack both seats. Guest room so each seat is a different user."}
        </p>
        {ready ? (
          <button
            type="button"
            onClick={reset}
            className="shrink-0 underline underline-offset-2 hover:text-zinc-300"
          >
            Run it again
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Preview({ kind }: { kind: BuildExample["preview"] }) {
  if (kind === "cursors") return <CursorsPreview />;
  if (kind === "war") return <WarPreview />;
  if (kind === "shared") return <SharedRoomPreview />;
  if (kind === "iot") return <IoTPreview />;
  return <DealPreview />;
}

export function LandingBuildGallery({
  examples = EXAMPLES,
  heading,
  subhead,
}: {
  examples?: BuildExample[];
  heading?: string;
  subhead?: string;
}) {
  const [activeId, setActiveId] = useState(examples[0].id);
  const [tab, setTab] = useState<"ui" | "code">("ui");
  const active = examples.find((e) => e.id === activeId) ?? examples[0];
  const title = heading ?? (examples.length === 1 ? "One room, humans and an agent" : "Copy the scaffold after you try a room");
  const lead =
    subhead ??
    (examples.length === 1
      ? "The agent writes on the same chat log. Cursors and IoT demos are on /labs."
      : "You need a Worker URL and a room first.");

  return (
    <section
      id="build-gallery"
      className="scroll-mt-20 border-b border-white/10 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-sm text-zinc-300 sm:text-base">
          {lead}
        </p>

        {examples.length === 1 ? null : (
        <div className="mt-8 grid grid-cols-2 gap-2 sm:mt-10 sm:grid-cols-4 sm:gap-3">
          {examples.map((ex) => (
            <button
              key={ex.id}
              type="button"
              onClick={() => {
                setActiveId(ex.id);
                setTab("ui");
              }}
              className={cn(
                "rounded-xl border px-3 py-3 text-left text-sm transition",
                activeId === ex.id
                  ? "border-[#ff6a1a]/60 bg-white/10 text-white"
                  : "border-white/10 bg-white/5 text-zinc-300 hover:bg-white/8",
              )}
            >
              <span className="block font-medium">{ex.title}</span>
              <span className="mt-1 block text-[11px] text-zinc-400 sm:text-xs">{ex.time}</span>
            </button>
          ))}
        </div>
        )}

        <SpotlightCard className="mt-5 border-white/10 bg-zinc-950/80 sm:mt-6" spotlightColor="rgba(255, 106, 26, 0.22)">
          <div className="p-3 sm:p-6">
            <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
              <button
                type="button"
                onClick={() => setTab("ui")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  tab === "ui" ? "bg-white text-zinc-950" : "bg-white/10 text-zinc-300",
                )}
              >
                Product
              </button>
              <button
                type="button"
                onClick={() => setTab("code")}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  tab === "code" ? "bg-white text-zinc-950" : "bg-white/10 text-zinc-300",
                )}
              >
                Code
              </button>
              <code className="mt-1 w-full truncate font-mono text-[10px] text-zinc-500 sm:ml-auto sm:mt-0 sm:w-auto sm:max-w-[min(100%,28rem)]">
                {active.command}
              </code>
            </div>
            {tab === "ui" ? (
              <Preview kind={active.preview} />
            ) : (
              <pre className="overflow-x-auto rounded-xl bg-zinc-900 p-3 font-mono text-[11px] leading-relaxed text-zinc-200 sm:p-4 sm:text-xs">
                {active.snippet}
              </pre>
            )}
          </div>
        </SpotlightCard>
      </div>
    </section>
  );
}
