import { Cpu, Globe, Layers } from "lucide-react";

const LANDING_STATS = [
  {
    icon: Globe,
    value: "Edge-first",
    label: "Pay Cloudflare for the edge slice, not a second realtime vendor and not a socket VPS.",
  },
  {
    icon: Cpu,
    value: "Hooks + REST",
    label: "Build UI with @fluxy-chat/sdk. Manage keys and quotas in the dashboard.",
  },
  {
    icon: Layers,
    value: "Multi-tenant",
    label: "Many projects and rooms on one deployment, with per-project billing hooks.",
  },
] as const;

export function LandingStatsSection() {
  return (
    <section className="border-b border-border bg-white px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <p className="mx-auto mb-10 max-w-2xl text-center text-sm text-muted-foreground">
          Deploy in your account. Quotas live in D1. Console access can require a one-time ack — usage still runs
          through your Worker with your keys.
        </p>
        <div className="grid gap-10 md:grid-cols-3">
          {LANDING_STATS.map((s) => (
            <div key={s.value} className="text-center md:text-left">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted/40">
                <s.icon className="h-6 w-6 text-primary" aria-hidden />
              </div>
              <p className="font-heading text-2xl font-bold tracking-tight text-foreground">{s.value}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

