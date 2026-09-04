"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Cpu, Gamepad2, MapPin, Pen, Radio, Truck, Video } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "@/lib/utils";

export type HeroPreviewSceneId =
  | "chat"
  | "agents"
  | "location"
  | "stream"
  | "collab"
  | "game"
  | "iot"
  | "channels";

export interface HeroPreviewScene {
  id: HeroPreviewSceneId;
  label: string;
  room: string;
  badge?: string;
}

export const KERNEL_PREVIEW_SCENES: readonly HeroPreviewScene[] = [
  { id: "chat", label: "Chat", room: "support-room", badge: "Live" },
  { id: "agents", label: "AI agents", room: "copilot", badge: "Agent" },
];

export const OPTIONAL_PREVIEW_SCENES: readonly HeroPreviewScene[] = [
  { id: "location", label: "Location", room: "delivery-42", badge: "Tracking" },
  { id: "stream", label: "Stream", room: "stage-main", badge: "1.2k live" },
  { id: "collab", label: "Collab", room: "planning", badge: "Syncing" },
  { id: "game", label: "Game", room: "arena-3", badge: "Match" },
  { id: "iot", label: "IoT", room: "factory-floor", badge: "3 devices" },
  { id: "channels", label: "Bridges", room: "inbox", badge: "Bridged" },
];

export const HERO_PREVIEW_SCENES: readonly HeroPreviewScene[] = [
  ...KERNEL_PREVIEW_SCENES,
  ...OPTIONAL_PREVIEW_SCENES,
];

const shell = {
  shellBg: "#12141a",
  shellText: "#e4e4e7",
  headerBorder: "rgba(255, 255, 255, 0.1)",
  liveDot: "#22c55e",
};

interface PreviewShellProps {
  scene: HeroPreviewScene;
  children: React.ReactNode;
}

function PreviewShell({ scene, children }: PreviewShellProps) {
  return (
    <div
      className="isolate flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl shadow-[var(--shadow-subtle-3)]"
      style={{
        backgroundColor: shell.shellBg,
        color: shell.shellText,
        border: `1px solid ${shell.headerBorder}`,
      }}
    >
      <div className="flex shrink-0 items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${shell.headerBorder}` }}>
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: shell.liveDot, boxShadow: "0 0 6px rgba(34,197,94,0.55)" }} />
          <span className="text-sm font-semibold">{scene.room}</span>
        </div>
        {scene.badge ? (
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
            {scene.badge}
          </span>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
      <div className="shrink-0 p-3" style={{ borderTop: `1px solid ${shell.headerBorder}` }}>
        <div className="flex gap-2 rounded-xl border border-white/10 bg-zinc-900 p-2">
          <div className="flex min-h-[36px] flex-1 items-center rounded-lg border border-white/10 bg-zinc-950 px-3 py-2 text-xs text-zinc-500">
            Write a message…
          </div>
          <Button size="sm" className="shrink-0 rounded-lg border border-[#C2410C] bg-[#C2410C] text-white hover:bg-[#9a3412]" type="button" tabIndex={-1}>
            Send
          </Button>
        </div>
      </div>
    </div>
  );
}

interface AltHeroPreviewProps {
  sceneId: HeroPreviewSceneId;
  scene: HeroPreviewScene;
}

export function AltHeroPreview({ sceneId, scene }: AltHeroPreviewProps) {
  if (sceneId === "chat") return <ChatHeroPreview scene={scene} />;
  if (sceneId === "agents") return <AgentsPreview scene={scene} />;
  if (sceneId === "location") return <LocationHeroPreview scene={scene} />;
  if (sceneId === "stream") return <StreamHeroPreview scene={scene} />;
  if (sceneId === "collab") return <CollabHeroPreview scene={scene} />;
  if (sceneId === "game") return <GameHeroPreview scene={scene} />;
  if (sceneId === "iot") return <IoTHeroPreview scene={scene} />;
  if (sceneId === "channels") return <ChannelsHeroPreview scene={scene} />;
  return null;
}

function ChatHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [typing, setTyping] = useState("");
  const full = "Hey team — deploy v2.4 looks good from here 🚀";
  const [msgs, setMsgs] = useState<Array<{ who: string; text: string; self?: boolean }>>([
    { who: "Maya", text: "Staging passed. Ready when you are." },
  ]);

  useEffect(() => {
    let i = 0;
    const typeTimer = window.setInterval(() => {
      i += 1;
      setTyping(full.slice(0, i));
      if (i >= full.length) window.clearInterval(typeTimer);
    }, 45);
    const sendTimer = window.setTimeout(() => {
      setMsgs((m) => [...m, { who: "You", text: full, self: true }]);
      setTyping("");
      window.setTimeout(() => {
        setMsgs((m) => [
          ...m,
          { who: "fluxybot", text: "Nice — I opened a thread summary card for the release notes." },
        ]);
      }, 700);
    }, full.length * 45 + 400);
    return () => {
      window.clearInterval(typeTimer);
      window.clearTimeout(sendTimer);
    };
  }, []);

  return (
    <PreviewShell scene={scene}>
      <div className="space-y-2 text-sm">
        {msgs.map((m, idx) => (
          <div
            key={`${m.who}-${idx}`}
            className={cn(
              "animate-in fade-in-0 slide-in-from-bottom-1 rounded-xl px-3 py-2 duration-300",
              m.self ? "ml-6 bg-[#C2410C] text-white" : "mr-6 bg-zinc-800 text-zinc-100",
            )}
          >
            {!m.self ? <span className="mb-0.5 block text-[10px] font-semibold text-zinc-400">{m.who}</span> : null}
            {m.text}
          </div>
        ))}
        {typing ? (
          <div className="ml-6 rounded-xl border border-dashed border-orange-500/40 bg-zinc-800 px-3 py-2 text-zinc-100">
            {typing}
            <span className="ml-0.5 inline-block h-3 w-0.5 animate-pulse bg-orange-500 align-middle" />
          </div>
        ) : null}
      </div>
    </PreviewShell>
  );
}

function AgentsPreview({ scene }: { scene: HeroPreviewScene }) {
  const [phase, setPhase] = useState(0);
  const [thinking, setThinking] = useState(true);

  useEffect(() => {
    setThinking(true);
    const thinkTimer = window.setTimeout(() => setThinking(false), 550);
    const id = window.setTimeout(() => setPhase((p) => (p + 1) % 3), 2200);
    return () => {
      window.clearTimeout(thinkTimer);
      window.clearTimeout(id);
    };
  }, [phase]);

  const reply =
    phase === 0
      ? "3 tickets open. Two billing, one webhook timeout on acme-prod."
      : phase === 1
        ? "Webhook retry succeeded. Billing tickets still need a human."
        : "Want me to draft replies for the billing threads?";

  return (
    <PreviewShell scene={scene}>
      <div className="space-y-3 text-sm">
        <div className="flex items-start gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
            <Bot className="size-3.5" aria-hidden />
          </span>
          <div className="rounded-xl bg-zinc-800 px-3 py-2 text-zinc-100">@fluxy summarize open tickets from today</div>
        </div>
        {thinking ? (
          <div className="ml-9 flex w-fit items-center gap-1 rounded-xl bg-zinc-800 px-3 py-2 animate-in fade-in-0 duration-200">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="inline-block size-1.5 animate-bounce rounded-full bg-orange-500"
                style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.6s" }}
              />
            ))}
          </div>
        ) : (
          <div
            key={phase}
            className="animate-in fade-in-0 slide-in-from-bottom-2 zoom-in-95 duration-350 ease-out rounded-xl bg-[#C2410C] px-3 py-2 text-white"
          >
            {reply}
          </div>
        )}
        {!thinking && phase >= 1 ? (
          <div className="flex gap-1">
            {["Approve", "Edit", "Dismiss"].map((btn, i) => (
              <span
                key={btn}
                style={{ animationDelay: `${150 + i * 90}ms` }}
                className="animate-in fade-in-0 slide-in-from-bottom-1 fill-mode-backwards duration-300 rounded-md border border-white/15 px-2 py-1 text-[10px] font-medium text-zinc-300 transition-colors hover:bg-white/10"
              >
                {btn}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </PreviewShell>
  );
}

const LOCATION_ROUTE = [
  { x: 10, y: 78 },
  { x: 24, y: 62 },
  { x: 30, y: 34 },
  { x: 52, y: 30 },
  { x: 60, y: 14 },
  { x: 82, y: 18 },
  { x: 90, y: 30 },
];

function LocationHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setStep((s) => (s >= LOCATION_ROUTE.length - 1 ? 0 : s + 1));
    }, 900);
    return () => window.clearInterval(id);
  }, []);

  const pos = LOCATION_ROUTE[step];
  const dest = LOCATION_ROUTE[LOCATION_ROUTE.length - 1];
  const routePath = LOCATION_ROUTE.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
  const eta = Math.max(1, LOCATION_ROUTE.length - 1 - step) * 2;

  return (
    <PreviewShell scene={scene}>
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <MapPin className="size-4 text-orange-500" aria-hidden />
          courier:maya · updated now
        </div>
        <div className="relative h-32 overflow-hidden rounded-xl bg-[#eef1f5]">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
            <g stroke="#d8dee6" strokeWidth="1.4">
              <line x1="0" y1="20" x2="100" y2="20" />
              <line x1="0" y1="50" x2="100" y2="50" />
              <line x1="0" y1="80" x2="100" y2="80" />
              <line x1="22" y1="0" x2="22" y2="100" />
              <line x1="55" y1="0" x2="55" y2="100" />
              <line x1="80" y1="0" x2="80" y2="100" />
            </g>
            <g fill="#e2e7ee">
              <rect x="4" y="4" width="12" height="10" rx="1.5" />
              <rect x="60" y="56" width="14" height="16" rx="1.5" />
              <rect x="30" y="6" width="18" height="8" rx="1.5" />
              <rect x="4" y="60" width="10" height="14" rx="1.5" />
            </g>
            <path d={routePath} fill="none" stroke="#f0501e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3.2 3" opacity="0.85" />
            <circle cx={dest.x} cy={dest.y} r="9" fill="none" stroke="#94a3b8" strokeDasharray="2 2" strokeWidth="1.2" />
            <g transform={`translate(${dest.x} ${dest.y})`}>
              <line x1="0" y1="6" x2="0" y2="-6" stroke="#334155" strokeWidth="1.4" />
              <path d="M0 -6 L5 -3.5 L0 -1 Z" fill="#334155" />
            </g>
          </svg>
          <div
            className="absolute transition-all duration-[850ms] ease-[cubic-bezier(0.4,0,0.2,1)]"
            style={{ left: `${pos.x}%`, top: `${pos.y}%`, transform: "translate(-50%, -50%)" }}
          >
            <span className="relative flex size-6 items-center justify-center">
              <span
                key={step}
                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-60 motion-reduce:animate-none"
              />
              <span className="relative flex size-3.5 items-center justify-center rounded-full border-2 border-orange-500 bg-slate-900 shadow-md" />
            </span>
          </div>
        </div>
        <p key={eta} className="animate-in fade-in-0 text-xs text-zinc-400 duration-300">
          ETA {eta} min · geofence: customer zone
        </p>
      </div>
    </PreviewShell>
  );
}

/**
 * Illustrated host avatar — blinks, breathes, sways gently, raises an eyebrow
 * while talking, and wears a headset/boom mic so the video area reads as a
 * real streamer mid-broadcast rather than a static placeholder.
 */
function StreamerAvatar({ speaking, size = 88 }: { speaking: boolean; size?: number }) {
  const [blink, setBlink] = useState(false);

  useEffect(() => {
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
        "inline-block transition-transform duration-300 ease-out motion-reduce:!transform-none",
        speaking && "scale-[1.035]",
      )}
      style={{ animation: "fluxy-avatar-sway 4.8s ease-in-out infinite" }}
    >
      <svg viewBox="0 0 120 142" width={size} height={(size * 142) / 120} className="overflow-visible motion-reduce:[&_*]:!animate-none" aria-hidden>
        <defs>
          <radialGradient id="fluxy-avatar-skin" cx="42%" cy="34%" r="72%">
            <stop offset="0%" stopColor="#ffd2a6" />
            <stop offset="55%" stopColor="#f0b98a" />
            <stop offset="100%" stopColor="#d99a68" />
          </radialGradient>
          <linearGradient id="fluxy-avatar-hair" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3a2c20" />
            <stop offset="100%" stopColor="#221a12" />
          </linearGradient>
          <linearGradient id="fluxy-avatar-shirt" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#414d63" />
            <stop offset="100%" stopColor="#232b38" />
          </linearGradient>
        </defs>

        <g style={{ transformBox: "fill-box", transformOrigin: "50% 100%", animation: "fluxy-avatar-breathe 3.6s ease-in-out infinite" }}>
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144 Z" fill="url(#fluxy-avatar-shirt)" />
          <path d="M6 144 Q6 90 60 90 Q114 90 114 144" fill="none" stroke="#151b26" strokeWidth="1" opacity="0.4" />
          {/* headset band + boom mic */}
          <path d="M20 46 Q60 5 100 46" fill="none" stroke="#111827" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="20" cy="49" r="4.5" fill="#111827" />
          <circle cx="100" cy="49" r="4.5" fill="#111827" />
          <path d="M100 49 Q109 60 78 67" fill="none" stroke="#111827" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="78" cy="67" r="3.2" fill="#111827" />
        </g>

        <rect x="49" y="70" width="22" height="26" rx="8" fill="#e3a476" />
        <rect x="49" y="80" width="22" height="12" rx="6" fill="#d4915f" opacity="0.45" />

        <ellipse cx="60" cy="52" rx="35" ry="36" fill="url(#fluxy-avatar-skin)" />
        <ellipse cx="24" cy="53" rx="5" ry="7" fill="#eab787" />
        <ellipse cx="96" cy="53" rx="5" ry="7" fill="#eab787" />

        <path d="M23 48 Q20 8 60 8 Q100 8 97 48 Q97 22 60 20 Q23 22 23 48 Z" fill="url(#fluxy-avatar-hair)" />
        <path d="M23 46 Q60 -2 97 46" fill="none" stroke="#19120c" strokeWidth="4" strokeLinecap="round" />

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
            animation: speaking ? "fluxy-avatar-talk 0.32s ease-in-out infinite" : undefined,
          }}
        />
        <path d="M50.5 67 Q60 71 69.5 67" fill="none" stroke="#5c2418" strokeWidth="0.8" opacity={speaking ? 0 : 1} />
      </svg>

      <style>{`
        @keyframes fluxy-avatar-talk {
          0%, 100% { transform: scaleY(0.26); }
          50% { transform: scaleY(1); }
        }
        @keyframes fluxy-avatar-sway {
          0%, 100% { transform: rotate(0deg) translateY(0); }
          50% { transform: rotate(1deg) translateY(-1px); }
        }
        @keyframes fluxy-avatar-breathe {
          0%, 100% { transform: scaleY(1); }
          50% { transform: scaleY(1.015); }
        }
      `}</style>
    </span>
  );
}

function StreamHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [hearts, setHearts] = useState<{ id: number; left: number; drift: number; rotate: number }[]>([]);
  const [speaking, setSpeaking] = useState(true);
  const [viewers, setViewers] = useState(1180);
  const [viewerBump, setViewerBump] = useState(false);
  const nextId = useRef(0);

  useEffect(() => {
    const speakTimer = window.setInterval(() => setSpeaking((s) => !s), 900);
    const viewerTimer = window.setInterval(() => {
      setViewers((v) => v + Math.floor(Math.random() * 7) - 2);
      setViewerBump(true);
      window.setTimeout(() => setViewerBump(false), 250);
    }, 2000);
    const heartTimer = window.setInterval(() => {
      const hid = nextId.current++;
      setHearts((h) => [
        ...h.slice(-8),
        { id: hid, left: 10 + Math.random() * 75, drift: -22 + Math.random() * 44, rotate: -20 + Math.random() * 40 },
      ]);
      window.setTimeout(() => setHearts((h) => h.filter((x) => x.id !== hid)), 2200);
    }, 480);
    return () => {
      window.clearInterval(speakTimer);
      window.clearInterval(viewerTimer);
      window.clearInterval(heartTimer);
    };
  }, []);

  return (
    <PreviewShell scene={scene}>
      <div className="relative aspect-video overflow-hidden rounded-xl bg-gradient-to-br from-slate-900 via-slate-800 to-orange-950">
        {/* soft webcam vignette so the avatar reads as a lit camera feed */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(ellipse at 50% 62%, rgba(255,255,255,0.08) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 100%)" }}
          aria-hidden
        />
        {/* Live host */}
        <div className="absolute inset-0 flex items-end justify-center pb-4">
          <div className="relative">
            <div
              className={cn(
                "absolute inset-0 -m-3 rounded-full bg-orange-500/20 blur-md transition-opacity duration-300",
                speaking ? "opacity-100" : "opacity-40",
              )}
            />
            <StreamerAvatar speaking={speaking} />
          </div>
        </div>
        {/* Waveform overlay */}
        <div className="absolute bottom-2 left-2 right-2 flex h-6 items-end gap-0.5 opacity-60">
          {Array.from({ length: 24 }).map((_, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-orange-400/80 transition-all duration-300"
              style={{
                height: speaking ? `${20 + Math.sin(i * 0.8) * 12 + (i % 3) * 4}%` : "20%",
              }}
            />
          ))}
        </div>
        <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white">
          <span className="size-1.5 animate-pulse rounded-full bg-white" />
          LIVE
        </span>
        <span
          className={cn(
            "absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] font-medium text-white tabular-nums transition-transform duration-200",
            viewerBump && "scale-110",
          )}
        >
          {viewers.toLocaleString()} watching
        </span>
        {hearts.map((h) => (
          <span
            key={h.id}
            className="pointer-events-none absolute bottom-8 animate-[floatUp_2s_cubic-bezier(0.16,1,0.3,1)_forwards] text-sm motion-reduce:animate-none"
            style={{
              left: `${h.left}%`,
              // @ts-expect-error custom property consumed by the keyframe
              "--heart-drift": `${h.drift}px`,
              "--heart-rotate": `${h.rotate}deg`,
            }}
          >
            ❤️
          </span>
        ))}
      </div>
      <div className="mt-2 flex gap-2 text-xs text-zinc-400">
        <Radio className="size-3.5 shrink-0 text-orange-500" aria-hidden />
        Host + HLS + chat overlay in sync
      </div>
      <style>{`
        @keyframes floatUp {
          0% { opacity: 1; transform: translate(0, 0) scale(1) rotate(0deg); }
          15% { opacity: 1; }
          100% { opacity: 0; transform: translate(var(--heart-drift, 0px), -56px) scale(0.6) rotate(var(--heart-rotate, 0deg)); }
        }
      `}</style>
    </PreviewShell>
  );
}

const COLLAB_NOTE_POS = [
  { top: 6, left: 8 },
  { top: 10, left: 58 },
  { top: 58, left: 22 },
];

function CollabHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [count, setCount] = useState(0);
  const notes = ["Ship v2", "Fix webhook", "Design review"];

  useEffect(() => {
    const timers = notes.map((_, i) => window.setTimeout(() => setCount(i + 1), 500 + i * 700));
    const loop = window.setInterval(() => {
      setCount(0);
      notes.forEach((_, i) => window.setTimeout(() => setCount(i + 1), 500 + i * 700));
    }, 4500);
    return () => {
      timers.forEach(window.clearTimeout);
      window.clearInterval(loop);
    };
  }, []);

  const cursorTarget = COLLAB_NOTE_POS[Math.min(count, notes.length - 1)];

  return (
    <PreviewShell scene={scene}>
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <Pen className="size-3.5" aria-hidden />
        CRDT board · 2 editors online
      </div>
      <div className="relative h-40 rounded-lg bg-zinc-900">
        <div
          className="absolute flex items-center gap-1 transition-all duration-700 ease-out"
          style={{ top: `${cursorTarget.top}%`, left: `${cursorTarget.left}%` }}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="drop-shadow-sm">
            <path d="M1 1l5.5 13 2-5.5L14 6.5 1 1z" fill="#6366f1" />
          </svg>
          <span className="rounded-full bg-indigo-500 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">Sam</span>
        </div>
        {notes.slice(0, count).map((note, i) => (
          <div
            key={note}
            style={{ top: `${COLLAB_NOTE_POS[i].top}%`, left: `${COLLAB_NOTE_POS[i].left}%` }}
            className={cn(
              "absolute animate-in fade-in-0 zoom-in-90 w-28 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-medium text-amber-950 shadow-sm duration-400 ease-out",
              i === 1 && "rotate-1",
              i === 2 && "-rotate-1",
            )}
          >
            {note}
          </div>
        ))}
      </div>
    </PreviewShell>
  );
}

function GameHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [scores, setScores] = useState([4, 3]);
  const [pulse, setPulse] = useState(false);
  const [scoredBy, setScoredBy] = useState<number | null>(null);

  useEffect(() => {
    const scoreTimer = window.setInterval(() => {
      setScores(([a, b]) => {
        const aScored = Math.random() > 0.45;
        const bScored = Math.random() > 0.55;
        if (aScored) setScoredBy(0);
        else if (bScored) setScoredBy(1);
        window.setTimeout(() => setScoredBy(null), 450);
        return [a + (aScored ? 1 : 0), b + (bScored ? 1 : 0)];
      });
      setPulse(true);
      window.setTimeout(() => setPulse(false), 200);
    }, 1000);
    return () => window.clearInterval(scoreTimer);
  }, []);

  return (
    <PreviewShell scene={scene}>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
        <span className="flex items-center gap-1.5">
          <Gamepad2 className="size-3.5" aria-hidden />
          Match found
        </span>
        <span className={cn("rounded-full bg-red-500/20 px-2 py-0.5 font-semibold text-red-300 transition-transform", pulse && "scale-110")}>
          LIVE
        </span>
      </div>
      <div className="relative mb-2 h-16 overflow-hidden rounded-lg bg-gradient-to-r from-slate-900 via-slate-800 to-orange-950">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(255,255,255,0.05) 8px, rgba(255,255,255,0.05) 9px)" }} />
        {["You", "Rival"].map((name, i) => (
          <div
            key={name}
            className={cn(
              "absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
              i === 0 ? "bg-orange-400" : "bg-blue-400",
              scoredBy === i ? "size-4" : "size-3",
            )}
            style={{ left: `${20 + scores[i] * 4}%` }}
          />
        ))}
      </div>
      {["You", "Rival"].map((name, i) => (
        <div
          key={name}
          className={cn(
            "mb-2 flex justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-300",
            i === 0 ? "bg-orange-500/20 text-orange-100" : "bg-zinc-800 text-zinc-100",
          )}
        >
          <span>{name}</span>
          <span
            key={scores[i]}
            className={cn("font-bold tabular-nums", scoredBy === i && "animate-in zoom-in-125 duration-300")}
          >
            {scores[i]}
          </span>
        </div>
      ))}
    </PreviewShell>
  );
}

function IoTHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const [temp, setTemp] = useState(22.4);
  const [alert, setAlert] = useState(false);
  const [bump, setBump] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTemp((t) => {
        const next = +(t + (Math.random() - 0.5) * 0.8).toFixed(1);
        setAlert(next > 23.5);
        return next;
      });
      setBump(true);
      window.setTimeout(() => setBump(false), 200);
    }, 1200);
    return () => window.clearInterval(id);
  }, []);

  const gaugePct = Math.min(100, Math.max(0, ((temp - 18) / 8) * 100));

  return (
    <PreviewShell scene={scene}>
      <div className="mb-2 flex items-center gap-2 text-xs text-slate-600">
        <Cpu className="size-3.5" aria-hidden />
        Device shadow · rule engine
      </div>
      <div className="space-y-2 text-sm">
        <div className="rounded-lg border border-white/10 px-3 py-2">
          <div className="flex justify-between">
            <span className="font-mono text-xs text-zinc-400">sensor-7</span>
            <span key={temp} className={cn("font-medium transition-transform duration-200", bump && "scale-110")}>
              {temp}°C
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700 ease-out",
                alert ? "bg-orange-500" : "bg-emerald-400",
              )}
              style={{ width: `${gaugePct}%` }}
            />
          </div>
        </div>
        <div
          className={cn(
            "grid transition-all duration-300 ease-out",
            alert ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden rounded-lg border border-orange-500/30 bg-orange-500/15 text-xs font-medium text-orange-200">
            <div className="px-3 py-2">Rule fired: alert ops in chat room</div>
          </div>
        </div>
      </div>
    </PreviewShell>
  );
}

function ChannelsHeroPreview({ scene }: { scene: HeroPreviewScene }) {
  const channels = ["Slack", "Discord", "Telegram", "WhatsApp"];
  const [step, setStep] = useState(0);
  const [justLanded, setJustLanded] = useState(-1);

  useEffect(() => {
    const id = window.setInterval(
      () =>
        setStep((s) => {
          const next = s >= channels.length + 1 ? 0 : s + 1;
          if (next >= 1 && next <= channels.length) {
            setJustLanded(next - 1);
            window.setTimeout(() => setJustLanded(-1), 300);
          }
          return next;
        }),
      650,
    );
    return () => window.clearInterval(id);
  }, [channels.length]);

  return (
    <PreviewShell scene={scene}>
      <p className="mb-2 text-xs text-zinc-400">One message → in-app + bridges</p>
      <div className="mb-3 rounded-lg bg-zinc-800 px-3 py-2 text-sm text-zinc-100">Deploy v2.4 is live 🚀</div>
      <div className="flex flex-wrap gap-1.5">
        {channels.map((ch, i) => (
          <span
            key={ch}
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium transition-all duration-300",
              i < step ? "bg-emerald-500/20 text-emerald-200" : "bg-zinc-800 text-zinc-500",
              justLanded === i && "scale-110",
            )}
          >
            {ch} {i < step ? <span className="inline-block animate-in zoom-in-50 duration-200">✓</span> : ""}
          </span>
        ))}
        <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">+10</span>
      </div>
      <div
        className={cn(
          "grid transition-all duration-300 ease-out",
          step > channels.length ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <p className="mt-2 overflow-hidden text-[11px] text-emerald-400">Delivered on all adapters</p>
      </div>
    </PreviewShell>
  );
}