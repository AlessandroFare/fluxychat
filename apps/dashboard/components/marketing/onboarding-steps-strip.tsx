"use client";

/**
 * OnboardingStepsStrip — hosted-first path (sign up → SDK → operate).
 */
import { cn } from "@/lib/utils";

const STEPS = [
  {
    n: "01",
    title: "Create account",
    body: "Fluxychat Cloud provisions a project and API credentials. No infra deploy yet.",
  },
  {
    n: "02",
    title: "Install SDK",
    body: "Add @fluxy-chat/sdk and point baseUrl at the hosted API.",
  },
  {
    n: "03",
    title: "First message",
    body: "Mint a member JWT, join a room, render chat with useChat.",
  },
  {
    n: "04",
    title: "Operate",
    body: "Use the console for rooms, agents, quotas, and billing.",
  },
] as const;

interface OnboardingStepsStripProps {
  className?: string;
}

export function OnboardingStepsStrip({ className }: OnboardingStepsStripProps) {
  return (
    <ol
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      aria-label="Onboarding path"
    >
      {STEPS.map((step, index) => (
        <li
          key={step.n}
          className="relative rounded-xl border border-border bg-[var(--am-whisper-gray)]/60 p-4"
        >
          {index < STEPS.length - 1 ? (
            <span
              className="pointer-events-none absolute -right-2 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-border lg:block"
              aria-hidden
            />
          ) : null}
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
            {step.n}
          </span>
          <p className="mt-2 font-heading text-sm font-semibold text-foreground">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}
