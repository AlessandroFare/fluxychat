import { IntegrationsConsolePage } from "./integrations-console";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Integrations: Turnstile & SMS",
  description:
    "Configure Cloudflare Turnstile, Sent.dm SMS, and entity-room webhooks (Linear/GitHub/…).",
  path: "/integrations",
});

export default function IntegrationsPage() {
  return <IntegrationsConsolePage />;
}

