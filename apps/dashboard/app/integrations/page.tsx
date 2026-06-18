import { IntegrationsConsolePage } from "./integrations-console";
import { buildPageMetadata } from "@/lib/site-metadata";

export const metadata = buildPageMetadata({
  title: "Integrations — Turnstile & SMS",
  description:
    "Configure Cloudflare Turnstile for the public demo and Sent.dm offline SMS for mentions and DMs.",
  path: "/integrations",
});

export default function IntegrationsPage() {
  return <IntegrationsConsolePage />;
}

