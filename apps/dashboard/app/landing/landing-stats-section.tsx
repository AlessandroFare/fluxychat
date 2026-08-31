import { Boxes, Cpu, Globe, Layers, Mic, Workflow } from "lucide-react";

const LANDING_STATS = [
  {
    icon: Globe,
    value: "Bridges",
    label: "Slack, Discord, Telegram, WhatsApp, Teams: you create the vendor app. Same channel_configs table, not a finished helpdesk.",
  },
  {
    icon: Cpu,
    value: "Agents in-room",
    label: "invokeAgent streams on the same timeline as chat. Copilots do not write the timeline.",
  },
  {
    icon: Layers,
    value: "One room DO",
    label: "Chat, sendCursor, Yjs, HTTP ingest, invokeAgent. A second binary WebSocket only if you mount Yjs.",
  },
  {
    icon: Workflow,
    value: "WorkflowAgent",
    label: "Optional D1-backed agent steps on the Worker. Not required for invokeAgent.",
  },
  {
    icon: Mic,
    value: "Voice signaling",
    label: "joinVoiceStage is a roster. Live audio is LiveKit. Clips are POST /messages/voice.",
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

