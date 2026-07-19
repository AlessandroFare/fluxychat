"use client";

import Link from "next/link";
import React from "react";
import { ArrowRight, Bell, Check, Cpu, Eye, Heart, MapPin, Mic, Radio, Flame } from "lucide-react";
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
    <section id="realtime" className="scroll-mt-20 border-b border-white/10 bg-slate-950 px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-400">Realtime SDK</p>
          <h2 className="text-balance font-heading text-3xl font-bold tracking-tight text-white sm:text-4xl">
            One room layer. Every live experience.
          </h2>
          <p className="mx-auto max-w-2xl text-pretty leading-relaxed text-slate-300">
            Build the interactions users expect without operating a socket fleet. Chat, fan-out events,
            foreground location, and web push share the same authenticated edge foundation.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Realtime capabilities"
          className="mt-10 grid grid-cols-2 gap-2 lg:grid-cols-4"
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
                  "relative flex min-h-24 flex-col items-start justify-between overflow-hidden rounded-xl border p-4 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
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

        <div
          key={active.id}
          id="landing-realtime-panel"
          role="tabpanel"
          aria-labelledby={`landing-realtime-tab-${active.id}`}
          className="rt-panel-enter mt-4 grid overflow-hidden rounded-2xl border border-white/10 bg-white/5 lg:grid-cols-[0.9fr_1.1fr]"
        >
          <div className="flex flex-col justify-between gap-8 border-b border-white/10 p-6 sm:p-8 lg:border-b-0 lg:border-r">
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

          <div className="min-h-80 bg-slate-950/60 p-4 sm:p-8">
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
    <div className="flex h-full min-h-72 items-center justify-center">
      {featureId === "chat" ? <ChatPreview /> : null}
      {featureId === "streaming" ? <StreamingPreview /> : null}
      {featureId === "location" ? <LocationPreview /> : null}
      {featureId === "push" ? <PushPreview /> : null}
      {featureId === "ai-transport" ? <AiTransportPreview /> : null}
      {featureId === "voice" ? <VoicePreview /> : null}
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
  { id: 2, from: "You", side: "right" as const, text: "Yep — the channel layer's already live.", reactions: [{ emoji: "+5", count: null }, { emoji: "\u2764\uFE0F", count: 17 }] },
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
    <div className="flex w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
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
    <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
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
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
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
    <div className="mx-auto w-full max-w-xs rounded-[2rem] border border-white/10 bg-slate-900 p-3 shadow-2xl">
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
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
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
    <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      {/* header */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <Mic className="size-4 text-blue-400" aria-hidden />
        <span className="text-xs font-semibold text-white">Voice Interface</span>
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
              idle — waiting for input
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