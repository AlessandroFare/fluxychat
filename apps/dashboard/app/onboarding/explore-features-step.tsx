"use client";

import Link from "next/link";
import { Layout, Wrench, Terminal, Shield, ArrowRight } from "lucide-react";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface ExploreFeaturesStepProps {
  wizard: OnboardingWizard;
}

const FEATURES = [
  {
    icon: Layout,
    title: "Card Builder",
    desc: "Design interactive cards with a live preview.",
    href: "/playground",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Wrench,
    title: "DevTools",
    desc: "Inspect WebSocket frames, API calls, and logs.",
    href: "/devtools",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: Terminal,
    title: "Create a Bot with CLI",
    desc: "Scaffold a new bot in seconds with create-fluxy-chat.",
    href: "/cli",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Shield,
    title: "Security",
    desc: "Manage API keys, JWTs, and access controls.",
    href: "/security",
    color: "text-amber-600 bg-amber-50",
  },
] as const;

export function ExploreFeaturesStep({ wizard: _w }: ExploreFeaturesStepProps) {
  return (
    <div className="mx-auto space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-foreground">Explore FluxyChat</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's what you can do next. Click any card to try it — you can always come back.
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
          <span className="font-medium text-foreground">Tip:</span> You don't need to visit all of these
          — they're just a preview of what's available. Click "Next" when you're ready to finish.
        </p>
      </div>
    </div>
  );
}
