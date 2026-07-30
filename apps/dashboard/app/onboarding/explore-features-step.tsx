"use client";

import Link from "next/link";
import { GraduationCap, Mic, Radio, Sparkles, ArrowRight } from "lucide-react";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface ExploreFeaturesStepProps {
  wizard: OnboardingWizard;
}

const FEATURES = [
  {
    icon: Mic,
    title: "Voice AI",
    desc: "STT → LLM → TTS with transport fallback on the room WebSocket.",
    href: "/voice-ai",
    color: "text-violet-600 bg-violet-50",
  },
  {
    icon: GraduationCap,
    title: "Live classroom",
    desc: "Polls, breakouts, and stage go-live on /edu with server_event fan-out.",
    href: "/edu",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Radio,
    title: "Realtime SDK demos",
    desc: "Chat, stream, collab, IoT, fleet, and spatial — one SDK, live previews.",
    href: "/features/realtime",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Sparkles,
    title: "LLM keys & agents",
    desc: "Connect OpenCode Zen or your provider, then tag @assistant in any room.",
    href: "/agents/llm-keys",
    color: "text-amber-600 bg-amber-50",
  },
] as const;

export function ExploreFeaturesStep({ wizard: _w }: ExploreFeaturesStepProps) {
  return (
    <div className="mx-auto space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Explore FluxyChat</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Production-ready modules you can try now. Open any card — or hit Next when you are ready to finish.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => {
          const Icon = feature.icon;
          return (
            <Link
              key={feature.title}
              href={feature.href}
              className="group relative flex items-start gap-4 overflow-hidden rounded-2xl border border-border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-foreground">{feature.title}</h4>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {feature.desc}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-primary" />
            </Link>
          );
        })}
      </div>

      <div className="rounded-xl border border-primary/15 bg-primary/5 p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> Card Builder, DevTools, and Security stay in the console nav — explore them after you land on the dashboard.
        </p>
      </div>
    </div>
  );
}
