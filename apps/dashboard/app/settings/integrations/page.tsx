"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Puzzle, Webhook } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";

const DEFAULT_EMBED_URL = process.env.NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL?.trim() ?? "";

export default function IntegrationsSettingsPage() {
  const [embedUrl, setEmbedUrl] = useState(DEFAULT_EMBED_URL);
  const [loaded, setLoaded] = useState(false);

  const isConfigured = embedUrl.length > 0;

  const docLinks = useMemo(
    () => [
      {
        href: "https://www.activepieces.com/docs/embedding/overview",
        label: "Activepieces embedding",
      },
      {
        href: "https://github.com/AlessandroFare/fluxychat/blob/main/docs/integrations/activepieces.md",
        label: "FluxyChat + Activepieces (internal)",
      },
    ],
    [],
  );

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Automation integrations"
        description="Connect FluxyChat webhooks to no-code flows via Activepieces (self-hosted or cloud)."
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel className="space-y-4 p-5">
          <div className="flex items-center gap-2">
            <Puzzle className="h-5 w-5 text-brand" />
            <h2 className="text-sm font-semibold">Activepieces embed</h2>
            <Badge variant="outline" className="text-[10px]">Beta POC</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Set <code className="text-xs">NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL</code> to your
            Activepieces embed URL (JWT-signed). Triggers: FluxyChat webhooks for{" "}
            <code className="text-xs">message.created</code>,{" "}
            <code className="text-xs">handoff.requested</code>.
          </p>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">Embed URL (override)</span>
            <Input
              value={embedUrl}
              onChange={(e) => {
                setLoaded(false);
                setEmbedUrl(e.target.value);
              }}
              placeholder="https://automation.example.com/embed?token=..."
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={!isConfigured} onClick={() => setLoaded(true)}>
              Load embed
            </Button>
            <Button type="button" size="sm" variant="secondary" asChild>
              <Link href="/settings/crm">CRM adapters</Link>
            </Button>
          </div>
        </Panel>

        <Panel className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            <h2 className="text-sm font-semibold">FluxyChat piece (planned)</h2>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Trigger: new message, room created, agent handoff</li>
            <li>Action: send message, create room via admin API</li>
            <li>Verify <code className="text-xs">X-Fluxy-Signature</code> on inbound webhooks</li>
          </ul>
          {docLinks.map((link) => (
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

      {loaded && isConfigured && (
        <Panel className="mt-6 overflow-hidden p-0">
          <iframe
            title="Activepieces automation"
            src={embedUrl}
            className="h-[min(70vh,640px)] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </Panel>
      )}

      {!isConfigured && (
        <p className="mt-4 text-sm text-muted-foreground">
          Configure an embed URL above or set{" "}
          <code className="text-xs">NEXT_PUBLIC_ACTIVEPIECES_EMBED_URL</code> in the dashboard env.
        </p>
      )}
    </ConsoleShell>
  );
}
