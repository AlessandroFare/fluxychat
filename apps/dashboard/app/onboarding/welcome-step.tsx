"use client";

import { Sparkles, Plug, Bot, Cloud, ChevronRight } from "lucide-react";
import Link from "next/link";
import { HOSTED_PATHS } from "@/lib/hosted-product";
import { FluxychatMark } from "@/components/FluxychatLogo";
import { cn } from "@/lib/utils";
import type { OnboardingWizard } from "./use-onboarding-wizard";

interface WelcomeStepProps {
  wizard: OnboardingWizard;
}

const VALUE_PROPS = [
  {
    icon: Plug,
    title: "Connect 14+ platforms",
    desc: "Slack, Discord, Telegram, WhatsApp, and more — unified in one inbox.",
  },
  {
    icon: Bot,
    title: "AI agents with tools",
    desc: "Streaming, tool calling, and human-in-the-loop approval built in.",
  },
  {
    icon: Cloud,
    title: "Deploy on Cloudflare",
    desc: "Edge-first architecture with D1, R2, and KV for sub-50ms responses.",
  },
] as const;

export function WelcomeStep({ wizard: w }: WelcomeStepProps) {
  return (
    <div className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden">
      {/* Animated gradient background */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(386% 163% at -13% -17%, rgba(232,64,13,0.12) 0%, rgba(255,238,216,0.5) 26%, rgba(208,178,255,0.3) 84%), radial-gradient(80% 109% at 52% 63%, rgba(208,178,255,0.2) 0%, rgba(198,236,233,0.3) 35%, rgba(153,255,249,0.15) 97%)",
        }}
        aria-hidden
      />

      {/* Logo + headline */}
      <div className="flex flex-col items-center px-4 text-center">
        <div className="mb-6 animate-[fadeIn_0.6s_ease-out]">
          <FluxychatMark size={56} />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl animate-[fadeIn_0.7s_ease-out]">
          Welcome to FluxyChat
        </h1>

        <p className="mt-3 max-w-xl text-base text-muted-foreground sm:text-lg animate-[fadeIn_0.8s_ease-out]">
          AI-native chat that runs on your edge
        </p>

        {/* Value prop cards */}
        <div className="mt-10 grid w-full gap-4 sm:grid-cols-3">
          {VALUE_PROPS.map((vp, i) => {
            const Icon = vp.icon;
            return (
              <div
                key={vp.title}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border bg-white/80 p-5 text-left shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md",
                  "animate-[fadeIn_0.9s_ease-out_both]",
                )}
                style={{ animationDelay: `${0.1 * (i + 1)}s` }}
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{vp.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{vp.desc}</p>
              </div>
            );
          })}
        </div>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => w.goNext()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-8 text-sm font-semibold text-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0"
          >
            Get Started
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link
            href={HOSTED_PATHS.console}
            className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Skip tour
          </Link>
        </div>

        {/* Auth hint for self-host users */}
        {!w.clerkSignedIn && !w.adminJwt.trim() && (
          <p className="mt-6 text-xs text-muted-foreground/70">
            You will connect your account in the next step
          </p>
        )}
      </div>
    </div>
  );
}
