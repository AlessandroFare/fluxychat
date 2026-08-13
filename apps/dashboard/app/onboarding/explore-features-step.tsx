"use client";

import {
  Bot,
  LayoutTemplate,
  Mic,
  Plug,
  Radio,
  ShieldCheck,
  Sparkles,
  Terminal,
  Zap,
} from "lucide-react";
import BlurText from "@/components/BlurText";
import type { OnboardingWizard } from "./use-onboarding-wizard";
import { OnboardingFeatureCard } from "./onboarding-feature-card";

interface ExploreFeaturesStepProps {
  wizard: OnboardingWizard;
}

const FEATURES = [
  {
    icon: Zap,
    title: "Realtime SDK demos",
    desc: "Chat, stream, collab, game, IoT, fleet, and spatial, live against your Worker.",
    href: "/features/realtime",
    accent: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: Mic,
    title: "Voice AI pipeline",
    desc: "STT → LLM → TTS with transport fallback on the room WebSocket.",
    href: "/voice-ai",
    accent: "bg-violet-500/10 text-violet-600",
  },
  {
    icon: Bot,
    title: "Agents & LLM keys",
    desc: "Configure providers, tool calling, and @mention agents in any room.",
    href: "/agents",
    accent: "bg-amber-500/10 text-amber-600",
  },
  {
    icon: LayoutTemplate,
    title: "Card builder",
    desc: "Rich interactive messages: buttons, tables, Slack Block Kit and Teams cards.",
    href: "/playground",
    accent: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: Terminal,
    title: "DevTools inspector",
    desc: "LLM calls, tool traces, token usage, with OpenTelemetry and GenAI conventions.",
    href: "/devtools",
    accent: "bg-slate-500/10 text-slate-700",
  },
  {
    icon: Plug,
    title: "14 platform adapters",
    desc: "Slack, Discord, Telegram, WhatsApp, Matrix, and more in one unified inbox.",
    href: "/integrations",
    accent: "bg-cyan-500/10 text-cyan-600",
  },
  {
    icon: ShieldCheck,
    title: "EU AI Act compliance",
    desc: "Risk profiles, HITL enforcement, gap assessment, and Annex IV export.",
    href: "/ai-governance/eu-ai-act",
    accent: "bg-rose-500/10 text-rose-600",
  },
  {
    icon: Radio,
    title: "FluxyStream & collab",
    desc: "Live broadcast overlays plus whiteboard, notes, and kanban per room.",
    href: "/stream",
    accent: "bg-orange-500/10 text-orange-600",
  },
] as const;

export function ExploreFeaturesStep({ wizard: _w }: ExploreFeaturesStepProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="text-center">
        <BlurText
          text="What you can build with FluxyChat"
          className="justify-center text-xl font-semibold text-foreground sm:text-2xl"
          delay={35}
          animateBy="words"
        />
        <p className="mt-3 max-w-lg mx-auto text-sm text-muted-foreground">
          These modules are already in your console. Browse the cards, or hit Finish when you are ready.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {FEATURES.map((feature) => (
          <OnboardingFeatureCard key={feature.title} {...feature} />
        ))}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/5 to-violet-500/5 p-4">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Tip:</span> After onboarding, use the sidebar
          (Build → Agents, Platform → Realtime demos) to go deeper. Everything links to a live console page.
        </p>
      </div>
    </div>
  );
}
