export interface SettingsCatalogItem {
  href: string;
  label: string;
  description: string;
}

export interface SettingsCatalogGroup {
  label: string;
  items: SettingsCatalogItem[];
}

/** Index of /settings/* pages so operators can find them without guessing URLs. */
export const SETTINGS_CATALOG: SettingsCatalogGroup[] = [
  {
    label: "Identity",
    items: [
      { href: "/settings/identity", label: "Identity", description: "Passkeys, SSO, SCIM" },
      { href: "/profile", label: "Profile", description: "Your user profile" },
    ],
  },
  {
    label: "Project & usage",
    items: [
      { href: "/settings/usage", label: "Usage", description: "Quotas and plan usage" },
      { href: "/settings/status", label: "Status page", description: "Public uptime" },
      { href: "/custom-domains", label: "Custom domains", description: "White-label hostnames" },
    ],
  },
  {
    label: "Messages & media",
    items: [
      { href: "/settings/media", label: "Media", description: "Uploads and attachments" },
      { href: "/settings/e2e", label: "E2E encryption", description: "Client-side encryption" },
      { href: "/settings/ephemeral", label: "Ephemeral", description: "Disappearing messages" },
      { href: "/settings/translation", label: "Translation", description: "Room language settings" },
      { href: "/settings/commands", label: "Commands", description: "Slash commands" },
      { href: "/settings/push", label: "Push", description: "Web push / VAPID" },
      { href: "/settings/search", label: "Search", description: "Keyword and semantic search" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/settings/agent-tools", label: "Agent tools", description: "Tool allow-list" },
      { href: "/settings/mcp", label: "MCP", description: "Model context protocol" },
      { href: "/middleware", label: "LLM middleware", description: "Guardrails and PII" },
    ],
  },
  {
    label: "Channels",
    items: [
      { href: "/settings/integrations", label: "Integrations", description: "Turnstile, SMS, WhatsApp" },
      { href: "/settings/telephony", label: "Telephony", description: "Voice / PSTN handoff" },
      { href: "/settings/crm", label: "CRM", description: "CRM adapters" },
      { href: "/settings/support", label: "Support", description: "Support routing" },
    ],
  },
  {
    label: "Compliance",
    items: [
      { href: "/settings/retention", label: "Retention", description: "Message retention policies" },
      { href: "/settings/dlp", label: "DLP", description: "Data loss prevention" },
      { href: "/settings/consent", label: "Consent", description: "Consent records" },
      { href: "/settings/hipaa", label: "HIPAA", description: "HIPAA workspace flags" },
      { href: "/settings/residency", label: "Residency", description: "Data region" },
      { href: "/settings/firmware", label: "Room firmware", description: "Room policy packs" },
      { href: "/privacy", label: "Privacy", description: "GDPR export and deletion" },
      { href: "/security", label: "Security", description: "Token encryption checklist" },
    ],
  },
];
