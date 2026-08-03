"use client";

import Link from "next/link";
import { Activity, ExternalLink } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Banner, Panel } from "../../components/ui";
import { Badge } from "~/components/ui/badge";

const STATUS_URL = process.env.NEXT_PUBLIC_STATUS_PAGE_URL?.trim() || "https://status.fluxychat.com";

const DEPLOY_STEPS = [
  "Create a public GitHub repo (e.g. fluxychat/status) from the Upptime template.",
  "Copy `.upptime/config.json` from this monorepo into that repo.",
  "Enable GitHub Actions + GitHub Pages on the status repo.",
  "Point DNS: CNAME `status.fluxychat.com` → `<org>.github.io` (or custom Pages URL).",
  "Verify `/health` returns 200 on your Worker before going live.",
];

const MONITORED = [
  { name: "Worker API", path: "/health", interval: "5 min" },
  { name: "Dashboard", path: "/", interval: "5 min" },
  { name: "Public demo", path: "/", interval: "15 min" },
];

export default function StatusPageSettings() {
  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Public status page"
        description="Zero-cost uptime history with Upptime (MIT) — enterprise pre-contract expectation (#62)."
        icon={Activity}
      />

      <Banner variant="info" className="mb-4">
        Config lives in <code className="text-xs">.upptime/config.json</code>. Full runbook:{" "}
        <Link href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/STATUS_PAGE_UPPTIME.md" className="underline">
          docs/STATUS_PAGE_UPPTIME.md
        </Link>
      </Banner>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Live status">
          <p className="text-sm text-muted-foreground">
            After deploy, operators and customers view uptime at:
          </p>
          <a
            href={STATUS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand underline underline-offset-2"
          >
            {STATUS_URL}
            <ExternalLink className="size-4" />
          </a>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge variant="secondary">Upptime</Badge>
            <Badge variant="outline">GitHub Pages</Badge>
            <Badge variant="outline">$0/month</Badge>
          </div>
        </Panel>

        <Panel title="Monitored endpoints">
          <ul className="space-y-2 text-sm">
            {MONITORED.map((row) => (
              <li key={row.name} className="flex justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span>{row.name}</span>
                <span className="text-muted-foreground">{row.interval}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            Edit hostnames in <code>.upptime/config.json</code> before first deploy.
          </p>
        </Panel>
      </div>

      <Panel title="Deploy checklist" className="mt-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          {DEPLOY_STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Panel>
    </ConsoleShell>
  );
}
