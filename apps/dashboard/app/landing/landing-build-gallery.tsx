"use client";

import { useEffect, useRef, useState } from "react";
import { Cursor } from "@fluxy-chat/ui";
import { SpotlightCard } from "~/components/marketing/spotlight-card";
import { cn } from "@/lib/utils";

type BuildExample = {
  id: string;
  title: string;
  time: string;
  command: string;
  snippet: string;
  preview: "cursors" | "war" | "iot" | "deal";
};

const EXAMPLES: BuildExample[] = [
  {
    id: "cursors",
    title: "Live cursors",
    time: "about 10 minutes",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors",
    snippet: `const { liveCursors, sendCursor } = useChat({ roomId });

function onMove(e: PointerEvent) {
  sendCursor({ x: e.clientX, y: e.clientY, color: "#ff6a1a" });
}`,
    preview: "cursors",
  },
  {
    id: "war",
    title: "Agent war room",
    time: "an afternoon",
    command: "npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room",
    snippet: `const { messages, invokeAgent } = useChat({ roomId });

await invokeAgent(agentId, "Summarize the last 20 messages");`,
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
    snippet: `await client.createDecision(roomId, { title: "Ship Friday?" });
await client.ackDecision(roomId, decisionId);
const md = await client.exportRoomMarkdown(roomId);`,
    preview: "deal",
  },
];

function CursorsPreview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [you, setYou] = useState({ x: 88, y: 72 });
  const [sam, setSam] = useState({ x: 210, y: 118 });
  const youRef = useRef(you);
  youRef.current = you;

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return undefined;
    let frame = 0;
    let t = 0;
    function tick() {
      t += 0.018;
      const target = youRef.current;
      setSam((prev) => ({
        x: prev.x + (target.x + 42 + Math.sin(t) * 16 - prev.x) * 0.09,
        y: prev.y + (target.y + 22 + Math.cos(t * 0.8) * 12 - prev.y) * 0.09,
      }));
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

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
      onPointerMove={(e) => moveTo(e.clientX, e.clientY)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        moveTo(e.clientX, e.clientY);
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgb(39 39 42 / 0.7) 1px, transparent 1px), linear-gradient(to bottom, rgb(39 39 42 / 0.7) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <Cursor cursor={{ userId: "you", x: you.x, y: you.y, color: "#ff6a1a", label: "You" }} />
      <Cursor cursor={{ userId: "sam", x: sam.x, y: sam.y, color: "#38bdf8", label: "Sam" }} />
      <p className="pointer-events-none absolute bottom-3 left-3 right-3 text-[11px] text-zinc-500">
        Move here. Your pointer is the orange one. Sam follows on the same room.
      </p>
    </div>
  );
}

function WarPreview() {
  const [lines, setLines] = useState([
    { id: "1", who: "alice", text: "Check the logs from the last hour" },
  ]);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("Summarize the last 20 messages");

  async function invoke() {
    if (busy) return;
    const prompt = draft.trim() || "Summarize the last 20 messages";
    setBusy(true);
    setLines((prev) => [...prev, { id: String(Date.now()), who: "you", text: prompt }]);
    setLines((prev) => [...prev, { id: `${Date.now()}-a`, who: "agent", text: "" }]);
    const reply = "3 errors in the last hour. Retry queue drained. No open incidents.";
    for (let i = 1; i <= reply.length; i += 1) {
      await new Promise((r) => setTimeout(r, 12));
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
        {lines.map((line) => (
          <div
            key={line.id}
            className={cn(
              "max-w-[90%] rounded-lg px-2.5 py-1.5",
              line.who === "you" && "ml-auto bg-zinc-100 text-zinc-900",
              line.who === "alice" && "bg-zinc-800 text-zinc-200",
              line.who === "agent" && "bg-orange-500/20 text-orange-100",
            )}
          >
            {line.who === "agent" ? `@ops ${line.text || "…"}` : line.text}
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
  const [acks, setAcks] = useState({ you: false, jordan: false });
  const [exported, setExported] = useState(false);
  const ready = acks.you && acks.jordan;

  return (
    <div className="flex h-56 flex-col justify-between rounded-xl bg-zinc-950 p-3 text-left text-[12px] text-zinc-200 sm:h-72">
      <div>
        <p className="text-sm font-medium text-white">Ship Friday?</p>
        <p className="mt-1 text-zinc-500">Decision in the deal room. Both sides ack, then export.</p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setAcks((a) => ({ ...a, you: !a.you }))}
            className={cn(
              "rounded-md border px-3 py-2 text-left",
              acks.you ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-zinc-900",
            )}
          >
            You · {acks.you ? "acked" : "pending"}
          </button>
          <button
            type="button"
            onClick={() => setAcks((a) => ({ ...a, jordan: !a.jordan }))}
            className={cn(
              "rounded-md border px-3 py-2 text-left",
              acks.jordan ? "border-emerald-400/50 bg-emerald-500/10" : "border-white/10 bg-zinc-900",
            )}
          >
            Jordan · {acks.jordan ? "acked" : "pending"}
          </button>
        </div>
      </div>
      <div>
        <button
          type="button"
          disabled={!ready}
          onClick={() => setExported(true)}
          className="rounded-md bg-[#ff6a1a] px-3 py-1.5 text-white disabled:opacity-40"
        >
          Export markdown
        </button>
        {exported ? (
          <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-900 p-2 font-mono text-[10px] text-zinc-300">
            {`# Ship Friday?\nStatus: committed\nAcks: you, jordan`}
          </pre>
        ) : null}
      </div>
    </div>
  );
}

function Preview({ kind }: { kind: BuildExample["preview"] }) {
  if (kind === "cursors") return <CursorsPreview />;
  if (kind === "war") return <WarPreview />;
  if (kind === "iot") return <IoTPreview />;
  return <DealPreview />;
}

export function LandingBuildGallery() {
  const [activeId, setActiveId] = useState(EXAMPLES[0].id);
  const [tab, setTab] = useState<"ui" | "code">("ui");
  const active = EXAMPLES.find((e) => e.id === activeId) ?? EXAMPLES[0];

  return (
    <section
      id="build-gallery"
      className="scroll-mt-20 border-b border-white/10 px-4 py-16 sm:px-6 sm:py-20"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Try the product, then copy the scaffold
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-sm text-zinc-300 sm:text-base">
          These are the gallery apps. Drag the cursors. Invoke an agent. Flick a sensor.
          Times assume you already have a Worker URL and a room.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-2 sm:mt-10 sm:grid-cols-4 sm:gap-3">
          {EXAMPLES.map((ex) => (
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
