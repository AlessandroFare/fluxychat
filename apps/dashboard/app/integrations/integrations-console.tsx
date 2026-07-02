"use client";

import Link from "next/link";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { IntegrationsStatusCard } from "../components/integrations-status-card";

export function IntegrationsConsolePage() {
  return (
    <ConsoleShell className="max-w-2xl">
      <ConsolePageHeader
        title="Integrations"
        description={
          <>
            Turnstile protects the guest demo; Sent.dm sends SMS when members are offline. Operator
            secrets live on the Worker — this page shows dashboard-side status and links.
          </>
        }
      />

      <IntegrationsStatusCard />

      <p className="mt-6 text-xs text-muted-foreground">
        Full checklists:{" "}
        <Link href="/guides/offline-notify-in-app-plus-sms" className="text-brand underline underline-offset-2">
          in-app + SMS guide
        </Link>
        {" · "}
        <a
          href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/operations/production-demo-and-sms.md"
          className="text-brand underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Production checklist (docs)
        </a>
      </p>
    </ConsoleShell>
  );
}

