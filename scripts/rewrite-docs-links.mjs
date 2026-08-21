#!/usr/bin/env node
/** Rewrite known-stale /docs/... hrefs in Fumadocs content. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DOCS = path.join(ROOT, "apps/docs/content/docs");

const REPLACEMENTS = [
  ["/docs/guides/security/jwt-auth", "/docs/guides/auth-jwt"],
  ["/docs/dashboard-integration", "/docs/reference/dashboard-integration"],
  ["/docs/message-middleware", "/docs/core/message-middleware"],
  ["/docs/testing-integration", "/docs/guides/testing-integration"],
  ["/docs/guides/realtime/web-push-vapid", "/docs/core/web-push"],
  ["/docs/guides/realtime/transport-fallback", "/docs/cookbook/transport-fallback"],
  ["/docs/transport-fallback", "/docs/cookbook/transport-fallback"],
  ["/docs/public-demo-hardening", "/docs/cookbook/public-demo-hardening"],
  ["/docs/offline-notify-sent-dm", "/docs/cookbook/offline-notify-sent-dm"],
  ["/docs/agent-memory", "/docs/guides/ai-agents/agent-memory"],
  ["/docs/custom-tools", "/docs/guides/ai-agents/tool-approval-hmac"],
  ["/docs/handoff", "/docs/guides/ai-agents/handoff"],
  ["/docs/core/messages", "/docs/core/use-chat"],
  ["/docs/guides/agents", "/docs/core/agents"],
  ["/docs/guides/react-quickstart", "/docs/packages/react"],
  ["/docs/architecture/wire-protocol", "/docs/architecture/response-envelope-extension"],
  ["/docs/guides/chat/moderation", "/docs/features/moderation-console"],
  ["/docs/observability-otel", "/docs/reference/observability-otel"],
  ["/docs/PRODUCTION-SETUP", "/docs/operations/production-setup"],
  ["/docs/kotlin-multiplatform", "/docs/integrations/kotlin-multiplatform"],
  ["/docs/maven-central-publish", "/docs/integrations/maven-central-publish"],
  ["/docs/staging-and-status", "/docs/operations/staging-and-status"],
  ["/docs/webhook-secret-migration", "/docs/webhooks/catalog"],
  ["/docs/platform/vertical-platform", "/docs/platform/vertical-industries"],
  ["/docs/auth-jwt", "/docs/guides/auth-jwt"],
  ["/docs/inbox", "/docs/core/inbox"],
  ["/docs/notifications", "/docs/core/notifications"],
  ["/docs/web-push-vapid", "/docs/core/web-push"],
  ["/docs/adapter-pattern", "/docs/guides/adapter-pattern"],
  ["/docs/unified-chat-api", "/docs/guides/unified-chat-api"],
  ["/docs/../packages/sdk/README", "/docs/packages/sdk"],
  ["/docs/agent-queue", "/docs/guides/ai-agents/agent-queue"],
  ["/docs/COMPETITIVE-STRATEGY", "/docs/architecture/competitive-strategy"],
  ["/docs/VOICE-LOAD-TEST-REPORT", "/docs/operations/voice-load-test-report"],
  ["/docs/us-sms-compliance-playbook", "/docs/operations/us-sms-compliance-playbook"],
  ["/docs/twilio-parity-inspiration", "/docs/operations/us-sms-compliance-playbook"],
  ["/docs/guides/ecosystem/mcp-audit-runbook", "/docs/operations/production-setup"],
  ["/docs/operations/scaling", "/docs/operations/production-setup"],
  ["/docs/guides/broadcast-campaigns", "/docs/guides/announcement-channels"],
  ["/docs/reference/notification-controls", "/docs/core/notifications"],
  ["/docs/reference/providers", "/docs/guides/provider-registry"],
  ["/docs/reference/generation", "/docs/guides/llm-middleware"],
  ["/docs/reference/stream-utils", "/docs/guides/stream-transforms"],
  ["/docs/security", "/docs/guides/security"],
];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.mdx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

function replaceExactPath(text, from, to) {
  const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`${escaped}(?![A-Za-z0-9_./-])`, "g");
  return text.replace(re, to);
}

let filesChanged = 0;
let hits = 0;
for (const file of walk(DOCS)) {
  let text = fs.readFileSync(file, "utf8");
  const original = text;
  for (const [from, to] of REPLACEMENTS) {
    if (from === to) continue;
    const next = replaceExactPath(text, from, to);
    if (next !== text) {
      hits += text.split(from).length - 1;
      text = next;
    }
  }
  if (text !== original) {
    fs.writeFileSync(file, text);
    filesChanged += 1;
  }
}

console.log(`Updated ${filesChanged} files (${hits} replacements).`);
