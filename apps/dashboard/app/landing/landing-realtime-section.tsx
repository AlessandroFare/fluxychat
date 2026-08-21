"use client";

import Link from "next/link";
import React from "react";
import { ArrowRight, Bell, Boxes, Check, Cpu, Eye, Gamepad2, GraduationCap, Heart, MapPin, Mic, Pen, Radio, Flame, Truck, Video } from "lucide-react";
import { FeatureCodeSnippet } from "@/components/showcase/feature-code-panel";
import {
  REALTIME_FEATURES,
  type RealtimeFeatureId,
} from "@/components/showcase/realtime-feature-content";
import { cn } from "@/lib/utils";

export function LandingRealtimeSection() {
  const [activeId, setActiveId] = React.useState<RealtimeFeatureId>("chat");
  const activeIndex = REALTIME_FEATURES.findIndex((feature) => feature.id === activeId);
  const active = REALTIME_FEATURES[activeIndex];

  const moveSelection = (direction: number) => {
    const nextIndex = (activeIndex + direction + REALTIME_FEATURES.length) % REALTIME_FEATURES.length;
    const next = REALTIME_FEATURES[nextIndex];
    setActiveId(next.id);
    requestAnimationFrame(() => document.getElementById(`landing-realtime-tab-${next.id}`)?.focus());
  };

  return (
    <section id="realtime" className="scroll-mt-20 border-b border-white/10 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase text-[var(--mkt-brand-soft)]">Realtime SDK</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One SDK for chat, location, stream, and more
          </h2>
          <p className="mx-auto max-w-2xl text-pretty leading-relaxed text-slate-300">
            Start with in-app chat. Add location, push, voice AI, collab, HLS stream, multiplayer, IoT, fleet GPS, spatial twins, or 14 channel adapters: one SDK, one worker, one room WebSocket.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Realtime capabilities"
          className="mt-10 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          onKeyDown={(event) => {
            if (event.key === "ArrowRight" || event.key === "ArrowDown") {
              event.preventDefault();
              moveSelection(1);
            }
            if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
              event.preventDefault();
              moveSelection(-1);
            }
          }}
        >
          <div className="inline-grid auto-cols-[minmax(7.5rem,1fr)] grid-flow-col grid-rows-2 gap-2 min-w-full sm:min-w-0 sm:grid sm:w-full sm:grid-cols-4 sm:grid-flow-row lg:grid-cols-7">
          {REALTIME_FEATURES.map((feature) => {
            const Icon = feature.icon;
            const selected = feature.id === activeId;
            return (
              <button
                key={feature.id}
                id={`landing-realtime-tab-${feature.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls="landing-realtime-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActiveId(feature.id)}
                className={cn(
                  "relative flex min-h-24 min-w-[7.5rem] shrink-0 flex-col items-start justify-between overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  selected
                    ? "border-blue-400/50 bg-blue-500/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-white hover:-translate-y-0.5",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="text-sm font-semibold">{feature.label}</span>
                {selected ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 animate-in fade-in-0 duration-300 bg-blue-400" aria-hidden />
                ) : null}
              </button>
            );
          })}
          </div>
        </div>

        <div
          key={active.id}
          id="landing-realtime-panel"
          role="tabpanel"
          aria-labelledby={`landing-realtime-tab-${active.id}`}
          className="rt-panel-enter mt-4 grid min-w-0 grid-cols-1 overflow-hidden rounded-2xl border border-white/10 bg-white/5 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="flex min-w-0 flex-col justify-between gap-8 border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-4">
              <h3 className="text-balance font-heading text-2xl font-semibold text-white">{active.title}</h3>
              <p className="text-pretty text-sm leading-relaxed text-slate-300">{active.description}</p>
              <pre className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-200">
                <code><FeatureCodeSnippet tokens={active.code} /></code>
              </pre>
            </div>
            <Link
              href="/features/realtime"
              className="group inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Open the live SDK demos
              <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </div>

          <div className="min-h-80 min-w-0 overflow-x-auto bg-slate-950/60 p-4 sm:p-8">
            <RealtimePreview featureId={active.id} />
          </div>
        </div>
      </div>

      <style>{`
        .rt-panel-enter { animation: rt-panel-in 420ms cubic-bezier(0.16, 1, 0.3, 1) both; }
        @keyframes rt-panel-in {
          0% { opacity: 0; transform: translateY(10px) scale(0.99); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .rt-reaction-pop {
          animation: rt-reaction-pop 380ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
        }
        @keyframes rt-reaction-pop {
          0% { opacity: 0; transform: scale(0.4); }
          60% { opacity: 1; transform: scale(1.15); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes ls-pulse-ring {
          0% { transform: scale(1); opacity: 0.4; }
          50% { transform: scale(1.08); opacity: 0.1; }
          100% { transform: scale(1); opacity: 0.4; }
        }
        @keyframes ls-float-up {
          0% { transform: translateY(0) scale(0.6); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-140px) scale(1.2); opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .rt-panel-enter { animation: none; }
          .rt-reaction-pop { animation: none; }
        }
      `}</style>
    </section>
  );
}

function RealtimePreview({ featureId }: { featureId: RealtimeFeatureId }) {
  return (
    <div className="flex h-full min-h-72 w-full min-w-0 items-center justify-center">
      {featureId === "chat" ? <ChatPreview /> : null}
      {featureId === "streaming" ? <StreamingPreview /> : null}
      {featureId === "location" ? <LocationPreview /> : null}
      {featureId === "push" ? <PushPreview /> : null}
      {featureId === "ai-transport" ? <AiTransportPreview /> : null}
      {featureId === "voice" ? <VoicePreview /> : null}
      {featureId === "collab" ? <CollabPreview /> : null}
      {featureId === "fluxy-stream" ? <FluxyStreamPreview /> : null}
      {featureId === "game" ? <GamePreview /> : null}
      {featureId === "iot" ? <IoTPreview /> : null}
      {featureId === "fleet" ? <FleetPreview /> : null}
      {featureId === "spatial" ? <SpatialPreview /> : null}
      {featureId === "edu-live" ? <EduLivePreview /> : null}
      {featureId === "omnichannel" ? <OmnichannelPreview /> : null}
    </div>
  );
}

/* ─────────────────────────── Chat ─────────────────────────── */

const CHAT_SIDEBAR = [
  { id: "team", name: "Ship Squad", initials: "SS", preview: "Leo: on it, adding you now.", time: "now", active: true, unread: 0 },
  { id: "dana", name: "Dana Ortiz", initials: "DO", preview: "sounds great, will ping...", time: "9m", active: false, unread: 2 },
  { id: "design", name: "Design Circle", initials: "DC", preview: "Wren: fresh comps up...", time: "23m", active: false, unread: 5 },
  { id: "leo", name: "Leo Martins", initials: "LM", preview: "You: deployed to staging", time: "1h", active: false, unread: 0 },
];

const CHAT_MESSAGES = [
  { id: 1, from: "Dana", side: "left" as const, text: "Are we still hitting today for the chat rollout?", reactions: [{ emoji: "\uD83D\uDC40", count: 9 }, { emoji: "\uD83D\uDD25", count: 6 }] },
  { id: 2, from: "You", side: "right" as const, text: "Yep, the channel layer's already live.", reactions: [{ emoji: "+5", count: null }, { emoji: "\u2764\uFE0F", count: 17 }] },
  { id: 3, from: "Leo", side: "left" as const, text: "Nice. Add me to the room.", reactions: [{ emoji: "\uD83C\uDF89", count: 4 }] },
];

function ChatPreview() {
  const [visible, setVisible] = React.useState(0);
  const [reactionCounts, setReactionCounts] = React.useState<Record<number, number>>({});
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(CHAT_MESSAGES.length);
      const fullCounts: Record<number, number> = {};
      CHAT_MESSAGES.forEach((m) => {
        fullCounts[m.id] = m.reactions.length;
      });
      setReactionCounts(fullCounts);
      return;
    }
    setVisible(0);
    setReactionCounts({});
    const timers: number[] = [];
    let lastEventTime = 0;
    CHAT_MESSAGES.forEach((m, idx) => {
      const showAt = 500 + idx * 950;
      timers.push(window.setTimeout(() => setVisible(idx + 1), showAt));
      // Reactions land one at a time, after the message has already appeared —
      // simulating other people reacting in real time rather than the message
      // showing up pre-decorated.
      m.reactions.forEach((_, rIdx) => {
        const reactAt = showAt + 750 + rIdx * 450;
        lastEventTime = Math.max(lastEventTime, reactAt);
        timers.push(
          window.setTimeout(
            () => setReactionCounts((prev) => ({ ...prev, [m.id]: (prev[m.id] ?? 0) + 1 })),
            reactAt,
          ),
        );
      });
    });
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), lastEventTime + 2200));
    return () => timers.forEach(window.clearTimeout);
  }, [cycle]);

  return (
    <div className="flex w-full max-w-full sm:max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
      {/* sidebar */}
      <div className="hidden w-40 shrink-0 border-r border-white/10 bg-slate-950/50 py-2 sm:block">
        {CHAT_SIDEBAR.map((c) => (
          <div
            key={c.id}
            className={cn(
              "flex items-center gap-2 px-3 py-2 text-left",
              c.active ? "bg-blue-500/10" : "",
            )}
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-slate-200">
              {c.initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-semibold text-white">{c.name}</p>
              <p className="truncate text-[10px] text-slate-500">{c.preview}</p>
            </div>
            {c.unread ? (
              <span className="flex size-3.5 items-center justify-center rounded-full bg-blue-500 text-[9px] font-bold text-white">
                {c.unread}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {/* chat pane */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <span className="text-sm font-semibold text-white">Ship Squad</span>
          <span className="flex items-center gap-2 text-xs text-slate-400">
            <span className="relative flex size-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400/60 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-blue-400" />
            </span>
            3 online
          </span>
        </div>

        <div className="flex min-h-56 flex-1 flex-col justify-end gap-2.5 p-4">
          {CHAT_MESSAGES.slice(0, visible).map((m) => {
            const shownReactions = m.reactions.slice(0, reactionCounts[m.id] ?? 0);
            return (
              <div key={m.id} className={cn("flex flex-col gap-1", m.side === "right" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm animate-in fade-in-0 slide-in-from-bottom-2 duration-400",
                    m.side === "right"
                      ? "rounded-br-sm bg-blue-500 text-white"
                      : "rounded-bl-sm bg-white/10 text-slate-200",
                  )}
                >
                  {m.text}
                </div>
                {shownReactions.length ? (
                  <div className="flex gap-1 px-1">
                    {shownReactions.map((r, i) => (
                      <span
                        key={i}
                        className="rt-reaction-pop rounded-full border border-white/10 bg-slate-950/80 px-1.5 py-0.5 text-[10px] text-slate-300"
                      >
                        {r.emoji}
                        {r.count ? ` ${r.count}` : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          {visible < CHAT_MESSAGES.length ? (
            <div className="flex items-center gap-1 px-1 text-[11px] text-slate-500">
              <span className="flex gap-0.5">
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "120ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "240ms" }} />
              </span>
              typing
            </div>
          ) : null}
        </div>

        <div className="border-t border-white/10 px-4 py-2.5">
          <div className="rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-500">
            Type your message...
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Streaming ─────────────────────────── */

const STREAM_COMMENTS = [
  { user: "milo", color: "text-blue-400", text: "this feels instant \uD83D\uDE2E" },
  { user: "reyna", color: "text-orange-400", text: "let's gooo, ship it" },
  { user: "otisq", color: "text-emerald-400", text: "fan-out is stupid fast \uD83D\uDD25" },
  { user: "zaraa", color: "text-pink-400", text: "channel layer doing work \uD83D\uDE4C" },
  { user: "finch", color: "text-blue-300", text: "caught my first live drop \uD83D\uDC40" },
  { user: "talia", color: "text-orange-300", text: "send the repo link!!" },
];

function StreamingPreview() {
  const [visible, setVisible] = React.useState(0);
  const [viewers, setViewers] = React.useState(1284);
  const [hearts, setHearts] = React.useState<{ id: number; left: number }[]>([]);
  const nextId = React.useRef(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const commentInterval = window.setInterval(
      () => {
        setVisible((v) => (v >= STREAM_COMMENTS.length ? 1 : v + 1));
        setViewers((v) => v + Math.round(Math.random() * 9 - 2));
      },
      reduce ? 999999 : 1200,
    );
    const heartInterval = window.setInterval(
      () => {
        const id = nextId.current++;
        setHearts((prev) => [...prev.slice(-5), { id, left: 55 + Math.random() * 30 }]);
        window.setTimeout(() => setHearts((prev) => prev.filter((h) => h.id !== id)), 1700);
      },
      reduce ? 999999 : 900,
    );
    if (reduce) setVisible(STREAM_COMMENTS.length);
    return () => {
      window.clearInterval(commentInterval);
      window.clearInterval(heartInterval);
    };
  }, []);

  const shown = STREAM_COMMENTS.slice(0, visible);

  return (
    <div className="relative w-full max-w-full sm:max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="flex items-center gap-1.5 rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80 opacity-75 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-white" />
          </span>
          Live
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-300">
          <Eye className="size-3.5" aria-hidden />
          <span key={viewers} className="tabular-nums animate-in fade-in-0 zoom-in-95 duration-200">
            {viewers.toLocaleString()}
          </span>
        </span>
      </div>

      <div className="relative flex h-56 flex-col justify-end gap-1 overflow-hidden px-4 py-3">
        {shown.map((c, i) => (
          <p
            key={`${c.user}-${i}-${visible}`}
            className="truncate text-xs leading-relaxed animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
          >
            <span className={cn("font-semibold", c.color)}>{c.user}</span>{" "}
            <span className="text-slate-300">{c.text}</span>
          </p>
        ))}

        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {hearts.map((h) => (
            <span
              key={h.id}
              className="absolute bottom-4 text-lg motion-reduce:hidden"
              style={{ left: `${h.left}%`, animation: "rt-float-up 1.7s cubic-bezier(0.16,1,0.3,1) forwards" }}
            >
              {Math.random() > 0.5 ? "\u2764\uFE0F" : "\uD83D\uDD25"}
            </span>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-white/10 px-4 py-2.5">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">
          <Heart className="size-3 text-blue-400" aria-hidden /> 4.2K
        </span>
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-slate-300">
          <Flame className="size-3 text-orange-400" aria-hidden /> 2.8K
        </span>
      </div>

      <style>{`
        @keyframes rt-float-up {
          0% { transform: translateY(0) scale(0.7); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-130px) scale(1.15); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── Location ─────────────────────────── */

const LOCATION_PATH = "M 40 210 L 130 210 L 130 130 L 230 130 L 230 55 L 310 55";
// Last point of LOCATION_PATH — kept in sync so the destination pin always
// lands exactly where the dashed route ends.
const LOCATION_DEST = { x: 310, y: 55 };
const LOCATION_ETA_MIN = 4;

function LocationPreview() {
  const [progress, setProgress] = React.useState(0);
  const [dotPoint, setDotPoint] = React.useState({ x: 40, y: 210 });
  const pathRef = React.useRef<SVGPathElement>(null);
  const startRef = React.useRef<number | null>(null);
  const rafRef = React.useRef<number>(0);
  const CYCLE_MS = 7000;
  const HOLD_MS = 1400;

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Compute the dot's position by sampling the actual <path> geometry
    // (getPointAtLength) instead of a separate CSS offset-path — this
    // guarantees the dot always sits exactly on the drawn route, regardless
    // of how the SVG is scaled inside its container.
    const updateDot = (p: number) => {
      const path = pathRef.current;
      if (!path) return;
      const length = path.getTotalLength();
      const point = path.getPointAtLength(length * p);
      setDotPoint({ x: point.x, y: point.y });
    };

    if (reduce) {
      setProgress(0.55);
      updateDot(0.55);
      return;
    }

    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const total = CYCLE_MS + HOLD_MS;
      const local = elapsed % total;
      const p = local < CYCLE_MS ? local / CYCLE_MS : 1;
      setProgress(p);
      updateDot(p);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const etaMin = Math.max(0, Math.ceil(LOCATION_ETA_MIN * (1 - progress)));
  const arrived = progress >= 0.995;

  return (
    <div className="w-full max-w-full sm:max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="relative h-56 overflow-hidden bg-[#e9edf1]">
        {/* map-like base */}
        <div className="absolute inset-0 [background-image:linear-gradient(#d8dee5_1px,transparent_1px),linear-gradient(90deg,#d8dee5_1px,transparent_1px)] [background-size:26px_26px]" />
        <div className="absolute inset-x-0 top-16 h-3 -rotate-1 bg-white" />
        <div className="absolute inset-x-0 top-28 h-4 rotate-1 bg-white" />
        <div className="absolute inset-y-0 left-20 w-3 rotate-3 bg-white" />
        <div className="absolute inset-y-0 left-56 w-4 -rotate-2 bg-white" />
        <div className="absolute left-10 top-8 h-16 w-20 rounded-sm bg-[#dfe4e9]" />
        <div className="absolute left-44 top-20 h-14 w-24 rounded-sm bg-[#dfe4e9]" />
        <div className="absolute left-8 top-32 h-10 w-16 rounded-sm bg-[#dfe4e9]" />

        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 350 240" aria-hidden>
          <path
            ref={pathRef}
            d={LOCATION_PATH}
            fill="none"
            stroke="#94a3b8"
            strokeWidth="3"
            strokeDasharray="1 7"
            strokeLinecap="round"
          />

          {/* moving dot — sampled from the path itself, so it can never drift off-route */}
          <circle cx={dotPoint.x} cy={dotPoint.y} r="7" fill="#3b82f6" stroke="white" strokeWidth="2" />
          {!arrived ? (
            <circle
              cx={dotPoint.x}
              cy={dotPoint.y}
              r="7"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="1.5"
              className="rt-dot-ping motion-reduce:hidden"
            />
          ) : null}

          {/* destination pin — pinned to the same coordinate the path ends on */}
          <g transform={`translate(${LOCATION_DEST.x - 12} ${LOCATION_DEST.y - 24})`}>
            <MapPin className="size-6 text-blue-500" aria-hidden fill="currentColor" fillOpacity={0.15} />
          </g>
        </svg>

        <div className="absolute left-4 top-4 rounded-full border border-black/5 bg-white/95 px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm">
          {arrived ? "Arrived" : "Courier \u00b7 live"}
        </div>
      </div>

      <div className="divide-y divide-white/10 border-t border-white/10">
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-[11px] font-semibold text-blue-300">
            WA
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-xs font-semibold text-white">Wren Ashby</p>
              <span className="shrink-0 text-xs font-medium text-slate-300">
                {arrived ? "Arrived" : `${etaMin} min`}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-blue-500 transition-[width] duration-100 ease-linear"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 opacity-60">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-300">
            SI
          </span>
          <p className="flex-1 truncate text-xs text-slate-300">Sana Iqbal</p>
          <span className="text-xs text-slate-500">0.9 mi</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 opacity-60">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-[11px] font-semibold text-slate-300">
            CR
          </span>
          <p className="flex-1 truncate text-xs text-slate-300">Callum Reyes</p>
          <span className="text-xs text-slate-500">2.1 mi</span>
        </div>
      </div>

      <style>{`
        .rt-dot-ping {
          transform-box: fill-box;
          transform-origin: center;
          animation: rt-dot-ping 1.4s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes rt-dot-ping {
          0% { transform: scale(1); opacity: 0.8; }
          75%, 100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

/* ─────────────────────────── Push ─────────────────────────── */

const PUSH_NOTIFS = [
  { id: 1, source: "FLUXYCHAT", title: "New comment on \u201cSprint Recap\u201d", body: "Wren: ready for review \uD83D\uDE80", icon: "bell" as const },
  { id: 2, source: "SLACK", title: "#shipping", body: "Wren mentioned you: ready for review", icon: "slack" as const },
  { id: 3, source: "MAIL", title: "New comment on \u201cSprint Recap\u201d", body: "Wren replied to your thread.", icon: "mail" as const },
];

function PushPreview() {
  const [visible, setVisible] = React.useState<number[]>([]);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(PUSH_NOTIFS.map((n) => n.id));
      return;
    }
    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        setVisible([]);
        await sleep(600);
        for (const n of PUSH_NOTIFS) {
          if (cancelled) return;
          setVisible((v) => [...v, n.id]);
          await sleep(750);
        }
        await sleep(1800);
        setVisible([]);
        await sleep(700);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-full sm:max-w-xs rounded-[2rem] border border-white/10 bg-slate-900 p-3 shadow-2xl">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] text-slate-500">
        <span>9:41</span>
        <span className="flex items-center gap-2">
          <Radio className="size-3" aria-hidden />
          <Check className="size-3" aria-hidden />
        </span>
      </div>
      <div className="flex min-h-64 flex-col gap-2">
        {PUSH_NOTIFS.filter((n) => visible.includes(n.id)).map((n) => (
          <div
            key={n.id}
            className="animate-in fade-in-0 slide-in-from-top-3 duration-400 rounded-xl border border-white/10 bg-slate-950 p-3"
          >
            <div className="flex items-start gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-500/15">
                <Bell className="size-4 text-blue-400" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                    {n.source}
                  </span>
                  <span className="text-[9px] text-slate-600">now</span>
                </div>
                <p className="truncate text-xs font-semibold text-white">{n.title}</p>
                <p className="truncate text-[11px] text-slate-400">{n.body}</p>
              </div>
            </div>
          </div>
        ))}
        {visible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-slate-600">
            Waiting for the next event...
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────── AI Transport ─────────────────────────── */

const AI_EVENTS = [
  { label: "Session created", detail: "device: Chrome · user: demo-01", icon: "start" as const },
  { label: "Message appended", detail: "offset 1 · \"hello from user\"", icon: "event" as const },
  { label: "Message appended", detail: "offset 2 · \"how does replay work?\"", icon: "event" as const },
  { label: "Device switched", detail: "Chrome → Mobile Safari", icon: "switch" as const },
  { label: "Replay from offset 0", detail: "2 events replayed", icon: "replay" as const },
];

function AiTransportPreview() {
  const [phase, setPhase] = React.useState(0);
  const [events, setEvents] = React.useState<{ label: string; detail: string; icon: string }[]>([]);
  const [replaying, setReplaying] = React.useState(false);
  const [replayIdx, setReplayIdx] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setEvents(AI_EVENTS.slice(0, 5));
      return;
    }

    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        // Phase 1: events trickle in
        setEvents([]);
        setReplaying(false);
        setReplayIdx(0);
        await sleep(500);
        for (let i = 0; i < 3; i++) {
          if (cancelled) return;
          setEvents((p) => [...p, AI_EVENTS[i]]);
          await sleep(900);
        }
        // Phase 2: device switch
        if (cancelled) return;
        setEvents((p) => [...p, AI_EVENTS[3]]);
        await sleep(1100);
        // Phase 3: replay animation
        if (cancelled) return;
        setReplaying(true);
        for (let i = 0; i < 2; i++) {
          if (cancelled) return;
          setReplayIdx(i + 1);
          await sleep(700);
        }
        await sleep(2000);
        setCycle((c) => c + 1);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [cycle]);

  return (
    <div className="w-full max-w-full sm:max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Cpu className="size-4 text-blue-400" aria-hidden />
        <span className="text-xs font-semibold text-white">Durable AI Transport</span>
        <span className="ml-auto rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-medium text-blue-300">
          Session active
        </span>
      </div>

      {/* session id bar */}
      <div className="border-b border-white/10 bg-slate-950/40 px-4 py-2">
        <div className="flex items-center gap-2 text-[10px]">
          <span className="text-slate-500">session:</span>
          <span className="font-mono text-slate-300">dur-session-04a2</span>
          <span className="ml-auto flex items-center gap-1 text-slate-500">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
            </span>
            connected
          </span>
        </div>
      </div>

      {/* event timeline */}
      <div className="flex flex-col gap-2 p-4">
        <div className="relative pl-5">
          {/* vertical line */}
          {events.length > 0 && events.length < 4 ? (
            <div className="absolute left-[7px] top-2 bottom-0 w-px bg-blue-500/20" aria-hidden />
          ) : null}

          {events.map((ev, i) => (
            <div key={`${cycle}-${i}`} className="relative mb-3 animate-in fade-in-0 slide-in-from-left-1 duration-400">
              <span className="absolute -left-[17px] flex size-3.5 items-center justify-center rounded-full border border-blue-500/30 bg-slate-900">
                {ev.icon === "start" ? (
                  <span className="size-1.5 rounded-full bg-blue-400" />
                ) : ev.icon === "switch" ? (
                  <ArrowRight className="size-2 text-orange-400" />
                ) : (
                  <span className="size-1 rounded-full bg-slate-500" />
                )}
              </span>
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-white">{ev.label}</p>
                {ev.icon === "switch" ? (
                  <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[9px] font-medium text-orange-300">device</span>
                ) : null}
              </div>
              <p className="text-[10px] text-slate-500">{ev.detail}</p>
            </div>
          ))}
        </div>

        {/* replay section */}
        {replaying ? (
          <div className="mt-1 rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 animate-in fade-in-0 duration-300">
            <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-300 mb-2">
              <span className="flex size-3 items-center justify-center rounded bg-blue-500/20 text-[8px]">&#x25B6;</span>
              Replaying from offset 0
            </div>
            <div className="flex flex-col gap-1.5">
              {AI_EVENTS.slice(0, 2).map((ev, i) => (
                <div
                  key={ev.label}
                  className={cn(
                    "flex items-center gap-2 rounded-md border border-white/5 bg-slate-950/60 px-2.5 py-1.5 text-[10px] transition-opacity duration-300",
                    i < replayIdx ? "opacity-100" : "opacity-0",
                  )}
                >
                  <span className="font-mono text-slate-500">#{i + 1}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-300">{ev.label}</span>
                    <span className="text-slate-600">{ev.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* offset counter */}
        {events.length > 0 ? (
          <div className="flex gap-3 rounded-lg border border-white/5 bg-slate-950/40 px-3 py-2 text-[10px]">
            <span className="text-slate-500">last offset</span>
            <span key={events.length} className="font-mono text-blue-300 tabular-nums animate-in fade-in-0 duration-200">
              {Math.min(events.length, 2)}
            </span>
            <span className="ml-auto text-slate-600">{Math.min(events.length, 3)} event{events.length !== 1 ? "s" : ""}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ─────────────────────────── Voice Interface ─────────────────────────── */

const VOICE_TRANSCRIPTS = [
  { text: "send message to #general", confidence: 0.97, mode: "push_to_talk" },
  { text: "what's the weather today?", confidence: 0.94, mode: "always_listening" },
  { text: "schedule a meeting for 3pm", confidence: 0.88, mode: "always_listening" },
  { text: "stop listening", confidence: 0.99, mode: "voice_activity_detection" },
];

function VoicePreview() {
  const [visible, setVisible] = React.useState(0);
  const [isListening, setIsListening] = React.useState(false);
  const [currentMode, setCurrentMode] = React.useState("push_to_talk");
  const [audioLevel, setAudioLevel] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(VOICE_TRANSCRIPTS.length);
      setIsListening(true);
      setCurrentMode("always_listening");
      setAudioLevel(0.6);
      return;
    }

    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        // Phase 1: push-to-talk
        setVisible(0);
        setIsListening(false);
        setCurrentMode("push_to_talk");
        setAudioLevel(0);
        await sleep(600);
        setIsListening(true);
        await sleep(400);
        // audio level animation
        for (let i = 0; i < 5; i++) { if (cancelled) return; setAudioLevel(0.3 + Math.random() * 0.5); await sleep(120); }
        setVisible(1);
        setIsListening(false);
        setAudioLevel(0);
        await sleep(1400);

        // Phase 2: always_listening
        setVisible(0);
        setIsListening(true);
        setCurrentMode("always_listening");
        await sleep(500);
        for (let i = 0; i < 3; i++) { if (cancelled) return; setAudioLevel(0.2 + Math.random() * 0.6); await sleep(100); }
        setVisible(1);
        await sleep(800);
        for (let i = 0; i < 3; i++) { if (cancelled) return; setAudioLevel(0.2 + Math.random() * 0.6); await sleep(100); }
        setVisible(2);
        await sleep(1600);

        // Phase 3: VAD
        setVisible(0);
        setIsListening(true);
        setCurrentMode("voice_activity_detection");
        await sleep(600);
        for (let i = 0; i < 3; i++) { if (cancelled) return; setAudioLevel(0.3 + Math.random() * 0.5); await sleep(100); }
        setVisible(1);
        await sleep(900);
        setVisible(2);
        await sleep(1200);

        setIsListening(false);
        setAudioLevel(0);
        await sleep(2000);
        setCycle((c) => c + 1);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, [cycle]);

  const modeColors: Record<string, string> = {
    push_to_talk: "bg-blue-500/15 text-blue-300 border-blue-500/20",
    always_listening: "bg-emerald-500/15 text-emerald-300 border-emerald-500/20",
    voice_activity_detection: "bg-purple-500/15 text-purple-300 border-purple-500/20",
  };

  const modeLabels: Record<string, string> = {
    push_to_talk: "Push to Talk",
    always_listening: "Always Listening",
    voice_activity_detection: "VAD",
  };

  return (
    <div className="w-full max-w-full sm:max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Mic className="size-4 text-blue-400" aria-hidden />
        <span className="text-xs font-semibold text-white">Voice AI</span>
        <span className={cn("ml-auto rounded-full border px-2 py-0.5 text-[10px] font-medium", modeColors[currentMode])}>
          {modeLabels[currentMode]}
        </span>
      </div>

      {/* waveform area */}
      <div className="flex h-28 items-center justify-center gap-0.5 border-b border-white/10 bg-slate-950/40 px-4">
        {isListening
          ? Array.from({ length: 32 }).map((_, i) => {
              const barHeight = Math.max(4, ((Math.sin(i * 0.8 + Date.now() * 0.005) * 0.5 + 0.5) * audioLevel * 64) + 4);
              return (
                <span
                  key={i}
                  className="w-1.5 rounded-full bg-gradient-to-t from-blue-500/60 to-blue-400 transition-all duration-75"
                  style={{ height: `${barHeight}px` }}
                />
              );
            })
          : <div className="flex items-center gap-2 text-[11px] text-slate-600">
              <span className="relative flex size-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-500/40 opacity-75 motion-reduce:animate-none" />
                <span className="relative inline-flex size-3 rounded-full bg-slate-500" />
              </span>
              idle, waiting for input
            </div>
        }
      </div>

      {/* transcripts */}
      <div className="flex flex-col gap-1.5 p-4">
        {VOICE_TRANSCRIPTS.slice(0, visible).map((t, i) => (
          <div
            key={`${cycle}-${i}`}
            className="flex items-center gap-2 rounded-lg border border-white/5 bg-slate-950/60 px-3 py-2 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
              <Mic className="size-3 text-blue-400" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs text-slate-200">{t.text}</p>
              <span className="text-[10px] text-slate-600">{t.mode.replace(/_/g, " ")}</span>
            </div>
            <span className="shrink-0 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-300">
              {Math.round(t.confidence * 100)}%
            </span>
          </div>
        ))}
        {visible === 0 ? (
          <div className="flex items-center justify-center py-6 text-[11px] text-slate-600">
            <span className="flex items-center gap-2">
              <span className="flex gap-0.5">
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "0ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "120ms" }} />
                <span className="size-1 animate-bounce rounded-full bg-slate-500 motion-reduce:animate-none" style={{ animationDelay: "240ms" }} />
              </span>
              listening...
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* ─────────────────────────── FluxyCollab ─────────────────────────── */

const COLLAB_NOTES = ["Ship v2", "Fix webhook", "Design review", "QA pass"];

function CollabPreview() {
  const [visible, setVisible] = React.useState(0);
  const [cycle, setCycle] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setVisible(COLLAB_NOTES.length);
      return;
    }
    setVisible(0);
    const timers = COLLAB_NOTES.map((_, i) =>
      window.setTimeout(() => setVisible(i + 1), 400 + i * 700),
    );
    timers.push(window.setTimeout(() => setCycle((c) => c + 1), 400 + COLLAB_NOTES.length * 700 + 1800));
    return () => timers.forEach(window.clearTimeout);
  }, [cycle]);

  return (
    <div className="w-full max-w-full sm:max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
        <Pen className="size-4 text-amber-400" aria-hidden />
        sprint-12 board
        <span className="ml-auto rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">CRDT sync</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {COLLAB_NOTES.slice(0, visible).map((note, i) => (
          <div
            key={`${cycle}-${note}`}
            className={cn(
              "rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs font-medium text-amber-100 animate-in fade-in-0 zoom-in-95 duration-300",
              i % 2 === 1 && "rotate-1",
            )}
          >
            {note}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── FluxyStream (HLS) ─────────────────────────── */

const STREAM_LINES = [
  "Hey everyone, welcome to the stream! 🚀",
  "Today I'm showing you our real-time architecture.",
  "This is how WebRTC connects to Cloudflare Stream.",
  "Notice the sub-second latency on chat overlay!",
  "Let me demo the multi-angle camera switch...",
];

const STREAM_CHAT = [
  { user: "milo", text: "this is unreal 🔥", color: "text-blue-400" },
  { user: "reyna", text: "the sync is crazy fast", color: "text-orange-400" },
  { user: "otisq", text: "what's the stack behind this?", color: "text-emerald-400" },
  { user: "zaraa", text: "chat overlay is seamless", color: "text-pink-400" },
];

/**
 * Illustrated host avatar — blinks, breathes, sways gently, raises an
 * eyebrow while talking, and wears a headset/boom mic so it reads as a
 * real streamer mid-broadcast rather than a flat icon.
 */
function StreamerAvatarSmall({ speaking = true }: { speaking?: boolean }) {
  const [blink, setBlink] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const schedule = () => {
      window.setTimeout(() => {
        if (cancelled) return;
        setBlink(true);
        window.setTimeout(() => {
          if (!cancelled) setBlink(false);
        }, 120);
        schedule();
      }, 2400 + Math.random() * 2200);
    };
    schedule();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <span
      className={cn(
        "block h-full w-full transition-transform duration-300 ease-out motion-reduce:!transform-none",
        speaking && "scale-[1.035]",
      )}
      style={{ animation: "rt-avatar-sway 4.8s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 120 142" className="h-full w-full overflow-visible motion-reduce:[&_*]:!animate-none" aria-hidden>
        <defs>
          <radialGradient id="rt-avatar-skin" cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#ffd2a6" />
            <stop offset="55%" stopColor="#f0b98a" />
            <stop offset="100%" stopColor="#d99a68" />
          </radialGradient>
          <linearGradient id="rt-avatar-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c3b8a" />
            <stop offset="100%" stopColor="#2c2160" />
          </linearGradient>
          <linearGradient id="rt-avatar-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b7ce6" />
            <stop offset="100%" stopColor="#5b4bc4" />
          </linearGradient>
        </defs>

        <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animation: "rt-avatar-breathe 3.6s ease-in-out infinite" }}>
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144 Z" fill="url(#rt-avatar-shirt)" />
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144" fill="none" stroke="#3c2f8f" strokeWidth="1" opacity="0.4" />
          {/* headset band + boom mic */}
          <path d="M20 46 Q60 5 100 46" fill="none" stroke="#1e1b4b" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="20" cy="49" r="4.5" fill="#1e1b4b" />
          <circle cx="100" cy="49" r="4.5" fill="#1e1b4b" />
          <path d="M100 49 Q109 60 78 67" fill="none" stroke="#1e1b4b" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="78" cy="67" r="3.2" fill="#1e1b4b" />
        </g>

        <rect x="49" y="70" width="22" height="26" rx="8" fill="#e3a476" />
        <rect x="49" y="80" width="22" height="12" rx="6" fill="#d4915f" opacity="0.45" />

        <ellipse cx="60" cy="52" rx="35" ry="36" fill="url(#rt-avatar-skin)" />
        <ellipse cx="24" cy="53" rx="5" ry="7" fill="#eab787" />
        <ellipse cx="96" cy="53" rx="5" ry="7" fill="#eab787" />

        <path d="M23 48 Q20 8 60 8 Q100 8 97 48 Q97 22 60 20 Q23 22 23 48 Z" fill="url(#rt-avatar-hair)" />
        <path d="M23 46 Q60 -2 97 46" fill="none" stroke="#211a4a" strokeWidth="4" strokeLinecap="round" />

        <path
          d="M40 40 Q47 36 54 39"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />
        <path
          d="M66 39 Q73 36 80 40"
          fill="none"
          stroke="#241b13"
          strokeWidth="2.3"
          strokeLinecap="round"
          style={{ transition: "transform 200ms ease-out", transformBox: "fill-box", transformOrigin: "center", transform: speaking ? "translateY(-1.4px)" : "translateY(0)" }}
        />

        <ellipse cx="48" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <ellipse cx="72" cy="50" rx="3.5" ry={blink ? 0.5 : 3.5} fill="#241b13" style={{ transition: "ry 90ms ease-out" }} />
        <circle cx="49.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />
        <circle cx="73.1" cy="48.6" r="0.9" fill="#fff" opacity={blink ? 0 : 0.85} />

        <path d="M60 50 Q58 58 60 60.5 Q62 59.5 61 56.5" fill="none" stroke="#d4915f" strokeWidth="1.5" strokeLinecap="round" />
        <ellipse cx="40" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />
        <ellipse cx="80" cy="62" rx="6" ry="3.2" fill="#f0916a" opacity="0.18" />

        <ellipse
          cx="60"
          cy="67"
          rx="9.5"
          ry="6"
          fill="#8a3f2f"
          style={{
            transformBox: "fill-box",
            transformOrigin: "center",
            transform: speaking ? undefined : "scaleY(0.26)",
            animation: speaking ? "rt-avatar-talk 0.32s ease-in-out infinite" : undefined,
          }}
        />
        <path d="M50.5 67 Q60 71 69.5 67" fill="none" stroke="#5c2418" strokeWidth="0.8" opacity={speaking ? 0 : 1} />
      </svg>

      <style>{`
        @keyframes rt-avatar-talk {
          0%, 100% { transform: scaleY(0.26); }
          50% { transform: scaleY(1); }
        }
        @keyframes rt-avatar-sway {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-1px); }
        }
        @keyframes rt-avatar-breathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.015); }
        }
      `}</style>
    </span>
  );
}

function FluxyStreamPreview() {
  const [viewers, setViewers] = React.useState(842);
  const [lineIdx, setLineIdx] = React.useState(0);
  const [chatVisible, setChatVisible] = React.useState(0);
  const [hearts, setHearts] = React.useState<{ id: number; left: number }[]>([]);
  const [speaking, setSpeaking] = React.useState(true);
  const nextId = React.useRef(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setLineIdx(STREAM_LINES.length - 1); setChatVisible(STREAM_CHAT.length); return; }

    let cancelled = false;
    const run = async () => {
      while (!cancelled) {
        for (let i = 0; i < STREAM_LINES.length; i++) {
          if (cancelled) return;
          setLineIdx(i);
          await new Promise((r) => setTimeout(r, 2000));
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
    };
    void run();

    const chatTimer = setInterval(() => {
      setChatVisible((v) => (v >= STREAM_CHAT.length ? 1 : v + 1));
    }, 1600);

    const viewerTimer = setInterval(() => {
      setViewers((v) => v + (reduce ? 0 : Math.floor(Math.random() * 12) - 3));
    }, 1200);

    const heartTimer = setInterval(() => {
      if (reduce) return;
      const id = nextId.current++;
      setHearts((h) => [...h.slice(-8), { id, left: 10 + Math.random() * 80 }]);
      setTimeout(() => setHearts((h) => h.filter((x) => x.id !== id)), 2200);
    }, 650);

    const speakTimer = setInterval(() => setSpeaking((s) => !s), 850);

    return () => {
      cancelled = true;
      clearInterval(chatTimer);
      clearInterval(viewerTimer);
      clearInterval(heartTimer);
      clearInterval(speakTimer);
    };
  }, []);

  return (
    <div className="relative w-full max-w-full sm:max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-950 via-slate-900 to-slate-950 p-4">
        {/* soft webcam vignette so the avatar reads as a lit camera feed */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 55%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.3) 100%)" }}
          aria-hidden
        />
        <div className="relative flex flex-col items-center gap-2">
          <div className="relative h-20 w-20">
            <div className="absolute inset-0 animate-[ls-pulse-ring_3s_ease-in-out_infinite] rounded-full border-2 border-emerald-500/30 motion-reduce:animate-none" />
            <StreamerAvatarSmall speaking={speaking} />
          </div>
          <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">LIVE</span>
          <p key={lineIdx} className="animate-in fade-in-0 slide-in-from-bottom-2 duration-400 text-center text-xs leading-relaxed text-slate-200">
            {STREAM_LINES[lineIdx]}
          </p>
        </div>
        <span className="absolute right-3 top-3 rounded-full bg-black/50 px-2 py-0.5 text-[10px] text-white">{viewers.toLocaleString()} watching</span>
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {hearts.map((h) => (
            <span
              key={h.id}
              className="absolute bottom-4 text-lg motion-reduce:hidden"
              style={{ left: `${h.left}%`, animation: "ls-float-up 2.2s cubic-bezier(0.16,1,0.3,1) forwards" }}
            >
              {h.id % 2 === 0 ? "❤️" : "🔥"}
            </span>
          ))}
        </div>
      </div>
      <div className="border-t border-white/10 px-3 py-2">
        <div className="flex flex-col gap-0.5">
          {STREAM_CHAT.slice(0, chatVisible).map((c, i) => (
            <p key={`${c.user}-${i}-${chatVisible}`} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-300 truncate text-[10px] leading-relaxed">
              <span className={cn("font-semibold", c.color)}>{c.user}</span>{" "}
              <span className="text-slate-400">{c.text}</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── FluxyGame ─────────────────────────── */

function GamePreview() {
  const [scores, setScores] = React.useState([8, 6]);
  const [tick, setTick] = React.useState(0);
  const [scoredBy, setScoredBy] = React.useState<number | null>(null);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      const aScored = Math.random() > 0.5;
      const bScored = !aScored && Math.random() > 0.55;
      setScores(([a, b]) => [a + (aScored ? 1 : 0), b + (bScored ? 1 : 0)]);
      if (aScored) setScoredBy(0);
      else if (bScored) setScoredBy(1);
      window.setTimeout(() => setScoredBy(null), 420);
      setTick((t) => t + 1);
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-full sm:max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-white">
        <span className="flex items-center gap-2">
          <Gamepad2 className="size-4 text-violet-400" aria-hidden />
          arena-3 · matchmaking
        </span>
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold text-red-400">LIVE</span>
      </div>

      {/* mini match field, mirrors player position by relative score */}
      <div className="relative mb-3 h-14 overflow-hidden rounded-lg bg-gradient-to-r from-violet-950 via-slate-900 to-slate-950">
        <div
          className="absolute inset-0 opacity-30"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.05) 9px)" }}
        />
        {["Player 1", "Player 2"].map((name, i) => (
          <div
            key={name}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              i === 0 ? "bg-violet-400" : "bg-blue-400",
              scoredBy === i ? "size-4" : "size-3",
            )}
            style={{ left: `${16 + scores[i] * 5}%` }}
          />
        ))}
      </div>

      {["Player 1", "Player 2"].map((name, i) => (
        <div key={name} className={cn("mb-2 flex justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-300", i === 0 ? "bg-violet-500/15 text-violet-100" : "bg-white/5 text-slate-200")}>
          <span>{name}</span>
          <span
            key={`${tick}-${i}`}
            className={cn("font-bold tabular-nums", scoredBy === i ? "animate-in zoom-in-125 duration-300" : "animate-in zoom-in-95 duration-200")}
          >
            {scores[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─────────────────────────── FluxyIoT ─────────────────────────── */

const IOT_READINGS = [
  { id: "sensor-7", label: "22.4°C", alert: false },
  { id: "line-2-motor", label: "1,840 rpm", alert: false },
  { id: "door-gate", label: "Open", alert: true },
];

function IoTPreview() {
  const [readings, setReadings] = React.useState(IOT_READINGS);
  const [pulse, setPulse] = React.useState(0);
  const [temp, setTemp] = React.useState(22.4);
  const [alert, setAlert] = React.useState(false);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setTemp((t) => {
        const next = +(t + (Math.random() - 0.5) * 0.9).toFixed(1);
        setAlert(next > 23.5);
        setReadings((rows) => rows.map((r, i) => (i === 0 ? { ...r, label: `${next.toFixed(1)}°C` } : r)));
        return next;
      });
      setPulse((p) => p + 1);
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  const gaugePct = Math.min(100, Math.max(0, ((temp - 18) / 8) * 100));

  return (
    <div className="w-full max-w-full sm:max-w-sm rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
        <Cpu className="size-4 text-cyan-400" aria-hidden />
        factory-floor · 3 devices
      </div>
      {readings.map((row, i) => (
        <div key={row.id} className={cn("mb-2 rounded-lg border px-3 py-2 text-xs", row.alert ? "border-orange-500/40 bg-orange-500/10" : "border-white/10 bg-slate-950/60")}>
          <div className="flex items-center justify-between">
            <span className="font-mono text-slate-400">{row.id}</span>
            <span key={`${pulse}-${row.id}`} className={cn("font-medium transition-transform duration-200", row.alert ? "text-orange-300" : "text-slate-200", i === 0 && "scale-105")}>
              {row.label}
            </span>
          </div>
          {i === 0 ? (
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className={cn("h-full rounded-full transition-all duration-700 ease-out", alert ? "bg-orange-400" : "bg-cyan-400")}
                style={{ width: `${gaugePct}%` }}
              />
            </div>
          ) : null}
        </div>
      ))}
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          alert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden rounded-lg border border-orange-500/30 bg-orange-500/10 text-[10px] font-medium text-orange-300">
          <div className="px-3 py-2">Rule fired: alert ops in chat room</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Fleet ─────────────────────────── */

function FleetPreview() {
  const [pos, setPos] = React.useState(28);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setPos((p) => (p >= 88 ? 12 : p + 4)), 900);
    return () => window.clearInterval(id);
  }, []);

  const arriving = pos >= 76;

  return (
    <div className="w-full max-w-full sm:max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-white">
        <span className="flex items-center gap-2">
          <Truck className="size-4 text-emerald-400" aria-hidden />
          Trip #1842 · en route
        </span>
        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-300", arriving ? "bg-emerald-500/15 text-emerald-300" : "bg-white/10 text-slate-400")}>
          {arriving ? "Entering geofence" : "In transit"}
        </span>
      </div>
      <div className="relative h-24 overflow-hidden rounded-xl bg-slate-950/80">
        <div
          className="absolute inset-x-4 top-1/2 h-0.5 -translate-y-1/2"
          style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(255,255,255,0.18), rgba(255,255,255,0.18) 6px, transparent 6px, transparent 12px)" }}
        />
        <div
          className="absolute right-6 top-1/2 size-10 -translate-y-1/2 rounded-full border border-dashed transition-colors duration-500"
          style={{ borderColor: arriving ? "rgba(52,211,153,0.6)" : "rgba(148,163,184,0.35)" }}
        />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-all duration-700 ease-out"
          style={{ left: `${pos}%` }}
        >
          <Truck className={cn("size-6 transition-colors duration-300", arriving ? "text-emerald-300" : "text-emerald-400")} aria-hidden />
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-500">Geofence: warehouse → customer · ETA {Math.max(1, Math.round((88 - pos) / 5))} min</p>
    </div>
  );
}

/* ─────────────────────────── Spatial ─────────────────────────── */

const SPATIAL_NODES = ["pump-3", "valve-12", "sensor-A"];

function SpatialPreview() {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setActive(SPATIAL_NODES.length - 1);
      return;
    }
    const id = window.setInterval(() => setActive((a) => (a + 1) % SPATIAL_NODES.length), 1200);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-full sm:max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
        <Boxes className="size-4 text-blue-400" aria-hidden />
        plant-floor twin
      </div>
      <div className="grid grid-cols-3 gap-2">
        {SPATIAL_NODES.map((node, i) => (
          <div key={node} className="relative rounded-lg">
            {i === active ? (
              <span className="absolute inset-0 -m-0.5 animate-[ls-pulse-ring_2s_ease-in-out_infinite] rounded-lg border border-blue-400/40 motion-reduce:animate-none" aria-hidden />
            ) : null}
            <div
              className={cn(
                "relative rounded-lg border px-2 py-3 text-center text-[10px] font-mono transition-all duration-300",
                i === active ? "border-blue-400/50 bg-blue-500/15 text-blue-200 scale-105" : "border-white/10 text-slate-500",
              )}
            >
              {node}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── FluxyEdu ─────────────────────────── */

const EDU_POLL_OPTIONS = ["Ship polls first", "Try breakouts", "Go live on stage"];

function EduLivePreview() {
  const [votes, setVotes] = React.useState([12, 7, 4]);
  const [activeBreakout, setActiveBreakout] = React.useState<string | null>(null);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const pollTimer = window.setInterval(() => {
      setVotes(([a, b, c]) => {
        const idx = Math.floor(Math.random() * 3);
        return idx === 0 ? [a + 1, b, c] : idx === 1 ? [a, b + 1, c] : [a, b, c + 1];
      });
    }, 1400);
    const breakoutTimer = window.setInterval(() => {
      setActiveBreakout((prev) => (prev ? null : "Group B"));
    }, 3200);
    return () => {
      window.clearInterval(pollTimer);
      window.clearInterval(breakoutTimer);
    };
  }, []);

  const total = votes.reduce((sum, n) => sum + n, 0);

  return (
    <div className="w-full max-w-full sm:max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-white">
        <GraduationCap className="size-4 text-emerald-400" aria-hidden />
        classroom:101 · live poll
      </div>
      <div className="space-y-2">
        {EDU_POLL_OPTIONS.map((label, i) => (
          <div key={label} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-200">{label}</span>
              <span className="font-mono text-emerald-300">{votes[i]}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${total ? (votes[i] / total) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      {activeBreakout ? (
        <p className="mt-3 animate-in fade-in-0 slide-in-from-bottom-1 text-[11px] font-medium text-emerald-300">
          Breakout opened: {activeBreakout} · server_event fan-out
        </p>
      ) : (
        <p className="mt-3 text-[11px] text-slate-500">Waiting for next breakout…</p>
      )}
    </div>
  );
}

/* ─────────────────────────── Omnichannel ─────────────────────────── */

const CHANNELS = ["Slack", "Discord", "Telegram", "WhatsApp", "Teams"];

function OmnichannelPreview() {
  const [lit, setLit] = React.useState(0);
  const [justLanded, setJustLanded] = React.useState(-1);

  React.useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setLit(CHANNELS.length);
      return;
    }
    const id = window.setInterval(() => {
      setLit((n) => {
        const next = n >= CHANNELS.length ? 0 : n + 1;
        if (next >= 1 && next <= CHANNELS.length) {
          setJustLanded(next - 1);
          window.setTimeout(() => setJustLanded(-1), 300);
        }
        return next;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="w-full max-w-full sm:max-w-md rounded-2xl border border-white/10 bg-slate-900 p-4">
      <p className="mb-3 text-xs font-semibold text-white">Message fan-out · same room</p>
      <div className="mb-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-200">Deploy v2.4 is live 🚀</div>
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((ch, i) => (
          <span
            key={ch}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-all duration-300",
              i < lit ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200" : "border-white/10 text-slate-600",
              justLanded === i && "scale-110",
            )}
          >
            {ch}
            {i < lit ? <Check className="size-2.5 animate-in zoom-in-50 duration-200" aria-hidden /> : null}
          </span>
        ))}
        <span className="rounded-full border border-white/10 px-2.5 py-1 text-[10px] text-slate-500">+9 more</span>
      </div>
      {lit >= CHANNELS.length ? (
        <p className="mt-3 animate-in fade-in-0 text-[11px] text-emerald-300">Delivered to in-app + bridged channels</p>
      ) : null}
    </div>
  );
}