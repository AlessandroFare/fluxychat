"use client";

import { ExternalLink, Puzzle, Webhook } from "lucide-react";
import Link from "next/link";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

/** Self-hosted Activepieces URL — opens in new tab (no iframe; embed is enterprise). */
const ACTIVEPIECES_URL = process.env.NEXT_PUBLIC_ACTIVEPIECES_URL?.trim() ?? "";

const DOC_LINKS = [
  {
    href: "https://github.com/AlessandroFare/fluxychat/blob/main/docs/integrations/activepieces.md",
    label: "FluxyChat + Activepieces setup",
  },
  {
    href: "https://www.activepieces.com/docs/overview/welcome",
    label: "Activepieces docs",
  },
] as const;

export default function IntegrationsSettingsPage() {
  const isConfigured = ACTIVEPIECES_URL.length > 0;

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Automation integrations"
        description="Connect FluxyChat webhooks to no-code flows via self-hosted Activepieces (MIT)."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-brand" />
            <h2 className="text-sm font-semibold">Activepieces studio</h2>
            <Badge variant="outline" className="text-[10px]">
              External
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Self-host Activepieces (free MIT) and open the automation studio in a new tab. Iframe
            embed inside FluxyChat requires an Activepieces enterprise license — we link out instead.
          </p>
          <p className="text-sm text-muted-foreground">
            Set{" "}
            <code className="text-xs">NEXT_PUBLIC_ACTIVEPIECES_URL</code> to e.g.{" "}
            <code className="text-xs">https://automation.yourdomain.com</code>
          </p>
          <div className="flex flex-wrap gap-2">
            {isConfigured ? (
              <Button type="button" size="sm" asChild>
                <a href={ACTIVEPIECES_URL} target="_blank" rel="noopener noreferrer">
                  Open automation studio
                  <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
            ) : (
              <Button type="button" size="sm" disabled>
                Configure ACTIVEPIECES_URL
              </Button>
            )}
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link href="/settings/crm">CRM adapters</Link>
            </Button>
          </div>
        </Panel>

        <Panel className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <h2 className="text-sm font-semibold">FluxyChat piece</h2>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Trigger: new message, room created, agent handoff</li>
            <li>Action: send message, create room via admin API</li>
            <li>Verify <code className="text-xs">X-Fluxy-Signature</code> on inbound webhooks</li>
            <li>Import from <code className="text-xs">examples/integrations/activepieces/src/</code></li>
          </ul>
          {DOC_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
            >
              {link.label}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ))}
        </Panel>
      </div>

      {!isConfigured && (
        <p className="mt-4 text-sm text-muted-foreground">
          See{" "}
          <a
            href="https://github.com/AlessandroFare/fluxychat/blob/main/docs/integrations/activepieces.md"
            className="font-medium text-brand hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            docs/integrations/activepieces.md
          </a>{" "}
          for Docker self-host steps.
        </p>
      )}
    </ConsoleShell>
  );
}
