"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, CircleDot, MessageSquare, Play, ShieldCheck, Users } from "lucide-react";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { ConsolePageHeader } from "./console-page-header";
import { ConsoleShell } from "./console-shell";

export interface VerticalStudioConfig {
  id: "edu" | "health" | "events" | "finance" | "continuity";
  name: string;
  eyebrow: string;
  description: string;
  readiness: "Beta" | "Preview" | "Prototype";
  journey: string[];
  metrics: Array<{ label: string; value: string }>;
  capabilities: Array<{ name: string; detail: string; status: "Ready" | "Adapter" | "Gated" }>;
  activity: Array<{ actor: string; action: string; time: string }>;
  primaryAction: string;
  complianceNote: string;
}

export function VerticalStudio({ config }: { config: VerticalStudioConfig }) {
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);

  function advance() {
    setRunning(true);
    setStep((current) => (current + 1) % config.journey.length);
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title={config.name}
        description={config.description}
        actions={<Badge variant="secondary">{config.readiness}</Badge>}
      />

      <div className="flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-foreground p-5 text-background sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-background/60">{config.eyebrow}</p>
              <h2 className="mt-2 text-balance font-heading text-2xl font-semibold sm:text-3xl">One room, the complete {config.id} workflow.</h2>
              <p className="mt-3 text-pretty text-sm leading-6 text-background/70">Start from a shared room and add only the capabilities this workflow needs. This studio uses deterministic demo data and clearly marks provider-backed boundaries.</p>
            </div>
            <Button type="button" onClick={advance} className="shrink-0 bg-background text-foreground hover:bg-background/90">
              <Play data-icon="inline-start" />
              {running ? "Advance demo" : config.primaryAction}
            </Button>
          </div>
          <div className="mt-6 grid gap-px overflow-hidden rounded-xl bg-background/15 sm:grid-cols-3">
            {config.metrics.map((metric) => (
              <div key={metric.label} className="bg-foreground p-4">
                <p className="text-2xl font-semibold tabular-nums">{metric.value}</p>
                <p className="mt-1 text-xs text-background/60">{metric.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Live journey</CardTitle>
              <CardDescription>A testable workflow built on the room kernel.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-2">
                {config.journey.map((item, index) => {
                  const complete = running && index < step;
                  const active = index === step;
                  return (
                    <li key={item} className="flex items-center gap-3 rounded-lg border border-border p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold" aria-hidden>
                        {complete ? <Check className="size-4" /> : index + 1}
                      </span>
                      <span className={active ? "font-medium text-foreground" : "text-sm text-muted-foreground"}>{item}</span>
                      {active ? <Badge className="ml-auto">Active</Badge> : null}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Room activity</CardTitle>
              <CardDescription>Versioned domain events, not hidden client state.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {config.activity.map((item, index) => (
                <div key={`${item.actor}-${item.action}`} className="flex gap-3">
                  <span className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
                    {index === 0 ? <CircleDot className="size-3.5" /> : index === 1 ? <MessageSquare className="size-3.5" /> : <Users className="size-3.5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm"><span className="font-medium">{item.actor}</span> {item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.time}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Capability readiness</CardTitle>
            <CardDescription>Production boundaries are visible before teams integrate.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {config.capabilities.map((capability) => (
              <div key={capability.name} className="rounded-xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{capability.name}</p>
                  <Badge variant={capability.status === "Ready" ? "default" : "outline"}>{capability.status}</Badge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{capability.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">{config.complianceNote}</p>
          </div>
          <Button asChild variant="outline" className="shrink-0">
            <Link href="/security">Review controls <ArrowRight data-icon="inline-end" /></Link>
          </Button>
        </div>
      </div>
    </ConsoleShell>
  );
}
