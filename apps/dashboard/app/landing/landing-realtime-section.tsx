"use client";

import Link from "next/link";
import React from "react";
import { ArrowRight, Bell, Check, Eye, Heart, MapPin, Radio } from "lucide-react";
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
                  "relative flex min-h-24 flex-col items-start justify-between overflow-hidden rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                  selected
                    ? "border-blue-400/50 bg-blue-500/10 text-white"
                    : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
                )}
              >
                <Icon className="size-5" aria-hidden />
                <span className="text-sm font-semibold">{feature.label}</span>
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
              className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-blue-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Open the live SDK demos
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="min-h-80 bg-slate-950/60 p-4 sm:p-8">
            <RealtimePreview featureId={active.id} />
          </div>
        </div>
      </div>
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
    </div>
  );
}

function ChatPreview() {
  return (
    <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-white">Product room</span>
        <span className="flex items-center gap-2 text-xs text-slate-400"><span className="size-2 rounded-full bg-blue-400" />3 online</span>
      </div>
      <div className="flex flex-col gap-3 p-4">
        <div className="rt-animate max-w-[82%] rounded-2xl rounded-bl-sm bg-white/10 px-4 py-3 text-sm text-slate-200 [animation:rt-rise-in_400ms_ease-out_both]">
          The new release is live. Can you check the room events?
        </div>
        <div className="rt-animate ml-auto max-w-[82%] rounded-2xl rounded-br-sm bg-blue-500 px-4 py-3 text-sm text-white [animation:rt-rise-in_400ms_120ms_ease-out_both]">
          Already watching them — delivery looks instant.
        </div>
        <div className="rt-animate flex items-center gap-1 px-2 text-xs text-slate-400 [animation:rt-rise-in_400ms_240ms_ease-out_both]">
          <span className="size-1.5 rounded-full bg-slate-400" />
          <span className="size-1.5 rounded-full bg-slate-400" />
          <span className="size-1.5 rounded-full bg-slate-400" />
          Maya is typing
        </div>
      </div>
    </div>
  );
}

function StreamingPreview() {
  return (
    <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900 p-5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-400">
          <span className="rt-animate size-2 rounded-full bg-blue-400 [animation:rt-live-pulse_1.4s_ease-in-out_infinite]" />Live
        </span>
        <span className="flex items-center gap-1.5 text-xs text-slate-300"><Eye className="size-4" aria-hidden />1,284</span>
      </div>
      <div className="mt-16 flex items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <p className="text-xl font-semibold text-white">Launch room</p>
          <p className="text-sm text-slate-400">Reactions fan out to every viewer.</p>
        </div>
        <div className="relative flex size-14 items-center justify-center rounded-full border border-blue-400/30 bg-blue-500/10">
          <Heart className="size-5 text-blue-400" aria-hidden />
          <Heart className="rt-animate absolute text-blue-400 [animation:rt-float-up_1.8s_ease-out_infinite]" aria-hidden />
        </div>
      </div>
    </div>
  );
}

function LocationPreview() {
  return (
    <div className="relative h-72 w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900">
      <div className="absolute inset-0 opacity-25 [background-image:linear-gradient(rgba(148,163,184,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.25)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute bottom-[22%] left-[14%] h-px w-[38%] bg-blue-400" />
      <div className="absolute bottom-[22%] left-[52%] h-[50%] w-px -rotate-[55deg] origin-bottom bg-blue-400" />
      <div className="rt-animate absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-lg [animation:rt-dot-move_5s_ease-in-out_infinite]">
        <span className="rt-animate absolute inset-0 rounded-full border border-blue-400 [animation:rt-ping_1.5s_ease-out_infinite]" />
      </div>
      <div className="absolute left-4 top-4 rounded-full border border-white/10 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-200">Courier · live</div>
      <MapPin className="absolute right-[14%] top-[18%] size-6 text-blue-400" aria-hidden />
    </div>
  );
}

function PushPreview() {
  return (
    <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-5">
      <div className="flex items-center gap-3 text-sm text-slate-300">
        <Radio className="size-5 text-blue-400" aria-hidden />
        Device delivery
      </div>
      <div className="rt-animate mt-8 rounded-xl border border-white/10 bg-slate-950 p-4 [animation:rt-rise-in_450ms_ease-out_both]">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10"><Bell className="size-5 text-blue-400" aria-hidden /></span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center justify-between gap-3"><p className="font-semibold text-white">FluxyChat</p><span className="text-xs text-slate-500">now</span></div>
            <p className="text-sm leading-relaxed text-slate-300">You have a new message in Product room.</p>
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400"><Check className="size-4 text-blue-400" aria-hidden />Delivered while the app was offline</div>
    </div>
  );
}
