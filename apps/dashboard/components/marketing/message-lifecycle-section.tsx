"use client";

import { CheckCircle2, Clock, Loader2, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: "pending", label: "Pending", icon: Loader2, detail: "Optimistic bubble in UI" },
  { id: "sent", label: "Sent", icon: CheckCircle2, detail: "Server ack + WS fan-out" },
  { id: "failed", label: "Failed", icon: WifiOff, detail: "Retry via clientMessageId" },
] as const;

export function MessageLifecycleSection() {
  return (
    <section
      id="lifecycle"
      className="scroll-mt-20 border-b border-[var(--mkt-border)] px-4 py-20 sm:px-6"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="text-balance text-center font-heading text-3xl font-bold tracking-tight text-[var(--mkt-text)]">
          Message lifecycle you can show users
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-center text-sm leading-relaxed text-[var(--mkt-text-muted)] sm:text-base">
          Per-message delivery state, connection UI with scheduled reconnect, and transport
          fallback when WebSockets drop.
        </p>
        <ul className="mx-auto mt-4 flex max-w-2xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-[var(--mkt-text-muted)]">
          <li>
            <code className="rounded bg-[var(--mkt-surface-2)] px-1.5 py-0.5 font-mono text-[var(--mkt-text)]">deliveryStatus</code>
          </li>
          <li>
            <code className="rounded bg-[var(--mkt-surface-2)] px-1.5 py-0.5 font-mono text-[var(--mkt-text)]">connectionState</code>
          </li>
          <li>
            <code className="rounded bg-[var(--mkt-surface-2)] px-1.5 py-0.5 font-mono text-[var(--mkt-text)]">nextRetryAt</code>
          </li>
          <li>WS → SSE → polling</li>
        </ul>
        <div className="mt-12 grid gap-6 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch md:gap-3">
          {STEPS.map((step, index) => (
            <div key={step.id} className="contents">
            <div
              className={cn(
                "rounded-2xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] p-6 shadow-sm",
                step.id === "pending" && "border-amber-200/80",
                step.id === "sent" && "border-emerald-200/80",
                step.id === "failed" && "border-destructive/30",
              )}
            >
              <step.icon
                className={cn(
                  "mb-3 h-8 w-8",
                  step.id === "pending" && "animate-spin text-amber-600",
                  step.id === "sent" && "text-emerald-600",
                  step.id === "failed" && "text-destructive",
                )}
                aria-hidden
              />
              <h3 className="font-semibold text-[var(--mkt-text)]">{step.label}</h3>
              <p className="mt-1 text-sm text-[var(--mkt-text-muted)]">{step.detail}</p>
            </div>
            {index < STEPS.length - 1 ? (
              <div
                className="hidden items-center justify-center text-muted-foreground/50 md:flex"
                aria-hidden
              >
                →
              </div>
            ) : null}
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-xl rounded-xl border border-[var(--mkt-border)] bg-[var(--mkt-surface)] p-4 font-mono text-xs text-[var(--mkt-text-muted)]">
          <p className="text-[var(--mkt-text)]">connectionState example</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap">
{`{
  status: "reconnecting",
  retryAttempt: 2,
  nextRetryAt: "2026-05-20T12:00:03.000Z",
  transport: "websocket"
}`}
          </pre>
          <p className="mt-3 flex items-center gap-2 text-[var(--mkt-text)]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            Render &quot;Reconnecting in 3s…&quot; without custom timers
          </p>
        </div>
      </div>
    </section>
  );
}
