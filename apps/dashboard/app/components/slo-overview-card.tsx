"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowRight, BarChart3, Loader2 } from "lucide-react";
import { useDashboardSession } from "./dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { messageFromUnknown } from "@/lib/error-message";
import { cn } from "@/lib/utils";

const SLO_WINDOW_MINUTES = 10_080; // 7 days

interface SloOverview {
  windowMinutes: number;
  sloStatus: {
    overallHealthy: boolean;
    healthScore: number;
    requestErrorRateMet: boolean;
    webhookSuccessRateMet: boolean;
  };
  sli: {
    requestErrorRate: number;
    webhookSuccessRate: number;
  };
  counters?: {
    requestsTotal: number;
    requestsError: number;
  };
}

function formatPct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export function SloOverviewCard() {
  const { adminJwt, hasHydrated, authHeader } = useDashboardSession();
  const workerUrl = getPublicWorkerUrl();
  const [slo, setSlo] = useState<SloOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const token = adminJwt.trim();
    if (!token) {
      setSlo(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const json = await fetchWorkerJson<SloOverview>(
        `${workerUrl}/stats/slo?minutes=${SLO_WINDOW_MINUTES}`,
        { headers: authHeader(token) },
      );
      setSlo(json);
    } catch (err) {
      setSlo(null);
      setError(messageFromUnknown(err, "SLO stats unavailable"));
    } finally {
      setLoading(false);
    }
  }, [adminJwt, authHeader, workerUrl]);

  useEffect(() => {
    if (!hasHydrated) return;
    void load();
  }, [hasHydrated, load]);

  if (!hasHydrated) return null;

  if (!adminJwt.trim()) {
    return (
      <section className="mb-8 rounded-2xl border border-dashed border-black/[0.1] bg-slate-50/80 p-5">
        <h2 className="font-heading text-base font-semibold text-foreground">SLO (7 days)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Mint an admin JWT in quickstart to see request error rate and webhook delivery SLO.
        </p>
      </section>
    );
  }

  const healthy = slo?.sloStatus.overallHealthy ?? false;
  const score = slo?.sloStatus.healthScore ?? 0;
  const successPct = slo ? (1 - slo.sli.requestErrorRate) * 100 : 0;
  const webhookPct = slo ? slo.sli.webhookSuccessRate * 100 : 0;

  return (
    <section className="mb-8 rounded-2xl bg-card p-4 shadow-[var(--shadow-2)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {loading ? (
            <Loader2 className="mt-0.5 h-5 w-5 animate-spin text-slate-500" aria-hidden />
          ) : (
            <BarChart3
              className={cn("mt-0.5 h-5 w-5", healthy ? "text-emerald-600" : "text-amber-600")}
              aria-hidden
            />
          )}
          <div>
            <h2 className="font-heading text-base font-semibold text-foreground">SLO · last 7 days</h2>
            {error ? (
              <p className="mt-1 text-sm text-red-600">{error}</p>
            ) : slo ? (
              <p className="mt-1 text-sm text-muted-foreground">
                Health score {score}% · {slo.counters?.requestsTotal ?? 0} requests tracked
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No SLO data yet</p>
            )}
          </div>
        </div>
        <Link
          href="/analytics"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Full analytics
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {slo ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-black/[0.06] bg-slate-50/80 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">API success</dt>
            <dd className={cn("mt-1 text-lg font-semibold", slo.sloStatus.requestErrorRateMet ? "text-emerald-700" : "text-amber-700")}>
              {successPct.toFixed(2)}%
            </dd>
          </div>
          <div className="rounded-lg border border-black/[0.06] bg-slate-50/80 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Webhook delivery</dt>
            <dd className={cn("mt-1 text-lg font-semibold", slo.sloStatus.webhookSuccessRateMet ? "text-emerald-700" : "text-amber-700")}>
              {webhookPct.toFixed(2)}%
            </dd>
          </div>
          <div className="rounded-lg border border-black/[0.06] bg-slate-50/80 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Error rate</dt>
            <dd className="mt-1 text-lg font-semibold text-foreground">
              {formatPct(slo.sli.requestErrorRate)}
            </dd>
          </div>
        </dl>
      ) : null}

      {!loading && slo && !healthy ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-amber-800">
          <Activity className="h-3.5 w-3.5 shrink-0" aria-hidden />
          One or more SLO targets missed. Review alerts in Analytics.
        </p>
      ) : null}
    </section>
  );
}
