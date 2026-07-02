import Link from "next/link";
import type { Metadata } from "next";
import { fetchWorkerHealth } from "@/lib/worker-health";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata: Metadata = buildPageMetadata({
  title: "System status — FluxyChat",
  description:
    "Public health endpoint for the FluxyChat chat API. Check operational status, bindings, and feature modes.",
  path: "/status",
});

export const dynamic = "force-dynamic";

function statusLabel(ok: boolean | undefined, degraded?: boolean): string {
  if (ok === undefined) return "Unknown";
  if (!ok) return "Major outage";
  if (degraded) return "Degraded";
  return "Operational";
}

function statusTone(ok: boolean | undefined, degraded?: boolean): string {
  if (ok === undefined) return "text-slate-600";
  if (!ok) return "text-red-600";
  if (degraded) return "text-amber-600";
  return "text-emerald-600";
}

export default async function StatusPage() {
  const health = await fetchWorkerHealth();
  const ok = health.data?.ok;
  const degraded = health.data?.degraded;
  const label = statusLabel(ok, degraded);
  const tone = statusTone(ok, degraded);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <h1 data-testid="status-heading" className="font-heading text-3xl font-bold tracking-tight">System status</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Public health for the chat API. Project-scoped operational alerts appear in the console
          when you are signed in.
        </p>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">Chat API</h2>
            <span className={`text-sm font-medium ${tone}`}>{label}</span>
          </div>
          <dl className="mt-6 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Endpoint</dt>
              <dd className="truncate font-mono text-xs">{health.workerUrl}/health</dd>
            </div>
            {health.error ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Error</dt>
                <dd className="text-red-600">{health.error}</dd>
              </div>
            ) : null}
            {health.httpStatus != null ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">HTTP</dt>
                <dd>{health.httpStatus}</dd>
              </div>
            ) : null}
            {health.data?.version ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Version</dt>
                <dd>{health.data.version}</dd>
              </div>
            ) : null}
            {health.data?.ts ? (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Checked at</dt>
                <dd>{new Date(health.data.ts).toISOString()}</dd>
              </div>
            ) : null}
          </dl>

          {health.data?.checks ? (
            <div className="mt-8">
              <h3 className="text-sm font-medium">Bindings</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.entries(health.data.checks).map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{key}</span>
                    <span className={value === "connected" ? "text-emerald-600" : "text-amber-600"}>
                      {value}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {health.data?.degradedFeatures ? (
            <div className="mt-8">
              <h3 className="text-sm font-medium">Feature modes</h3>
              <ul className="mt-3 space-y-2 text-sm">
                {Object.entries(health.data.degradedFeatures).map(([key, value]) => (
                  <li key={key} className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{key}</span>
                    <span>{value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <p className="mt-8 text-xs text-muted-foreground">
          For tenant-specific incidents (webhook failures, quota spikes), open{" "}
          <Link href="/analytics" className="underline underline-offset-2">
            Analytics
          </Link>{" "}
          in the console after connecting your project.
        </p>
      </div>
    </div>
  );
}
