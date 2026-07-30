"use client";

import { useEffect, useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

interface HealthPayload {
  ok?: boolean;
  status?: string;
  degradedFeatures?: string[];
}

type HealthView =
  | { kind: "loading" }
  | { kind: "ok"; status: string; degraded: string[] }
  | { kind: "degraded"; status: string; degraded: string[] }
  | { kind: "error"; message: string };

export function WorkerHealthCard() {
  const workerUrl = getPublicWorkerUrl();
  const [view, setView] = useState<HealthView>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`${workerUrl}/health`, { cache: "no-store" });
        const json = (await res.json().catch(() => ({}))) as HealthPayload;
        if (cancelled) return;

        if (!res.ok) {
          setView({ kind: "error", message: `HTTP ${res.status}` });
          return;
        }

        const status = json.status ?? (json.ok ? "healthy" : "unknown");
        const degraded = Array.isArray(json.degradedFeatures) ? json.degradedFeatures : [];
        setView(
          degraded.length > 0 || status !== "healthy"
            ? { kind: "degraded", status, degraded }
            : { kind: "ok", status, degraded },
        );
      } catch (err) {
        if (!cancelled) {
          setView({
            kind: "error",
            message: err instanceof Error ? err.message : "Unreachable",
          });
        }
      }
    }

    void load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [workerUrl]);

  const icon =
    view.kind === "loading" ? (
      <Loader2 className="h-4 w-4 animate-spin text-slate-500" aria-hidden />
    ) : view.kind === "ok" ? (
      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
    ) : view.kind === "degraded" ? (
      <Activity className="h-4 w-4 text-amber-600" aria-hidden />
    ) : (
      <AlertCircle className="h-4 w-4 text-red-600" aria-hidden />
    );

  const title =
    view.kind === "loading"
      ? "Checking worker…"
      : view.kind === "ok"
        ? "Worker healthy"
        : view.kind === "degraded"
          ? "Worker degraded"
          : "Worker unreachable";

  const detail =
    view.kind === "ok" || view.kind === "degraded"
      ? view.degraded.length > 0
        ? `Status ${view.status} · ${view.degraded.join(", ")}`
        : `Status ${view.status}`
      : view.kind === "error"
        ? view.message
        : workerUrl;

  return (
    <section className="mb-8 rounded-2xl border border-black/[0.06] bg-white/90 p-5 shadow-[var(--shadow-subtle-2)]">
      <div className="flex items-start gap-3">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="font-heading text-base font-semibold text-slate-900">{title}</h2>
          <p className={cn("mt-1 truncate text-sm text-muted-foreground")}>{detail}</p>
          <p className="mt-2 truncate font-mono text-[11px] text-slate-500">{workerUrl}</p>
        </div>
      </div>
    </section>
  );
}
