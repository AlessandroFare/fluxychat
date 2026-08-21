import { Boxes, Cpu, Globe, Layers, Mic, Workflow } from "lucide-react";

const LANDING_STATS = [
  {
    icon: Globe,
    value: "14 platforms",
    label: "Slack, Discord, Telegram, WhatsApp, Teams, and 9 more on one unified adapter interface.",
  },
  {
    icon: Cpu,
    value: "AI-native",
    label: "Streaming markdown, tool calling, MCP client, and LLM middleware pipeline built in.",
  },
  {
    icon: Layers,
    value: "30+ SDK modules",
    label: "Rooms, presence, typing, history, agents, webhooks, cards, and more, all on @fluxy-chat/sdk.",
  },
  {
    icon: Workflow,
    value: "Durable agents",
    label: "WorkflowAgent persists to D1, survives deploys, and resumes from the last step.",
  },
  {
    icon: Mic,
    value: "Realtime voice",
    label: "Bidirectional voice-to-voice AI with provider-agnostic abstraction.",
  },
  {
    icon: Boxes,
    value: "MIT self-host",
    label: "Deploy the Worker + D1 in your Cloudflare account. Read every line of source.",
  },
] as const;

export function LandingStatsSection() {
  return (
    <section className="border-b border-[var(--mkt-border)] px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="mx-auto mb-10 max-w-2xl text-pretty text-center text-sm text-[var(--mkt-text-muted)]">
          Deploy in your account. Quotas live in D1. Console access can require a one-time ack; usage still runs
          through your Worker with your keys.
        </p>
        <div className="grid gap-10 md:grid-cols-3">
          {LANDING_STATS.map((s) => (
            <div key={s.value} className="text-center md:text-left">
              <div className="mb-4 inline-flex size-12 items-center justify-center rounded-xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)]">
                <s.icon className="size-6 text-[var(--mkt-brand)]" aria-hidden />
              </div>
              <p className="font-heading text-balance text-2xl font-bold tracking-tight text-[var(--mkt-text)] tabular-nums">{s.value}</p>
              <p className="mt-2 text-pretty text-sm leading-relaxed text-[var(--mkt-text-muted)]">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

