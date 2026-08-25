#!/usr/bin/env node
/**
 * Outbound fetch guard (SSRF).
 *
 * The worker has a good SSRF guard in `lib/url-ssrf.ts`
 * (`assertSafeOutboundUrl` / `safeOutboundFetch`) and roughly twenty modules use
 * it. The problem was never the guard, it was consistency: the same class of
 * call was protected in one file and raw in the file next to it. Two of those raw
 * calls took a URL straight from tenant configuration:
 *
 *   - lib/matrix-bridge.js       homeserver base URL from the tenant's config
 *   - lib/channel-structured-forms.js  `outboundUrl` for RCS delivery
 *
 * This gate makes the rule mechanical: any `fetch(` in the worker must either go
 * through the guard or be explicitly allow-listed here with a reason. New
 * unguarded outbound calls fail CI instead of waiting for the next audit.
 *
 * Run: node scripts/check-outbound-fetch.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const workerSrc = resolve(repoRoot, "apps/worker/src");

/**
 * Calls that are legitimately raw `fetch`. Each entry needs a reason, because an
 * allowlist without reasons becomes a place to hide problems.
 *
 * Categories that qualify:
 *  - fixed vendor hostname compiled into the source (no user or tenant input can
 *    redirect it, and safeOutboundFetch would add nothing)
 *  - operator-configured URL that may INTENTIONALLY be a private address in a
 *    self-hosted deployment (a self-hosted ClamAV or an internal alerting
 *    endpoint is normal); blocking RFC1918 there would break valid installs,
 *    and the operator configuring their own worker is not the threat actor
 *  - request to a Durable Object / service binding stub (never leaves the edge)
 *  - the guard implementation itself
 *
 * NOT acceptable: any URL that a tenant or end user can influence. Those must go
 * through safeOutboundFetch, which also re-validates redirect hops.
 */
const ALLOWLIST = new Map([
  ["lib/url-ssrf.ts", "the guard implementation performs the actual fetch"],
  ["lib/turnstile.js", "fixed hostname challenges.cloudflare.com"],
  ["lib/cloudflare-stream.js", "fixed hostname api.cloudflare.com"],
  ["lib/do-outbound-keepalive.js", "Durable Object stub fetch, stays inside the edge"],
  ["durable-objects/room-do.js", "Durable Object stub fetch (internal routing)"],
  ["durable-objects/user-do.js", "Durable Object stub fetch (internal routing)"],
  ["durable-objects/ip-rate-limiter-do.js", "Durable Object stub fetch (internal routing)"],
  ["durable-objects/supergroup-router-do.js", "Durable Object stub fetch (internal routing)"],
  ["lib/embed-frame-html.js", "generates HTML for the browser; fetch appears inside a template string"],
  ["lib/embed-loader.js", "generates client-side loader JS; fetch appears inside a template string"],
  ["lib/transport.js", "generic transport primitive; callers must pass a guarded base URL"],
  ["lib/direct-chat-transport.js", "generic transport primitive; callers must pass a guarded base URL"],

  // Fixed vendor hostnames.
  ["lib/digest-email.js", "fixed hostname api.resend.com"],
  ["lib/image-generation.js", "fixed hostname api.openai.com"],
  ["lib/tts.js", "fixed hostname api.openai.com"],
  ["lib/live-stream-stripe-checkout.js", "fixed hostname api.stripe.com"],
  ["routes/billing-http.js", "fixed hostname api.stripe.com (checkout + billing portal)"],
  ["lib/llm-model-catalog.js", "fixed hostname openrouter.ai"],
  ["lib/llm-models-catalog.js", "fixed MODELS_DEV_URL constant"],
  ["lib/offline-notify-sent.js", "fixed hostname api.sent.dm"],
  ["lib/sent-dm-contacts.js", "fixed hostname api.sent.dm, URL built from a literal"],
  ["lib/push-notifications.js", "fixed hostname fcm.googleapis.com (legacy FCM); VAPID path is guarded"],
  ["lib/agent-llm.js", "fixed hostname api.anthropic.com; the configurable OpenAI path uses safeOutboundFetch"],
  ["lib/ai-image-generation.js", "fixed hostname image.pollinations.ai; the configurable path is guarded"],
  ["lib/channel-structured-forms.js", "fixed hostname graph.facebook.com; the tenant-supplied RCS path is guarded"],

  // Operator-configured endpoints that are allowed to be internal by design.
  [
    "lib/media-pipeline.js",
    "env.CLAMAV_HTTP_URL — a self-hosted antivirus is normally on a private address, so the SSRF guard would break valid self-host deployments",
  ],
  [
    "lib/operational-alerts.js",
    "env.ALERT_DISPATCH_WEBHOOK_URL — operator-owned alert sink, frequently an internal collector",
  ],
  [
    "routes/live-streaming-http.js",
    "env-configured TURN credential endpoint, operator-owned and often internal",
  ],
]);

/** Files whose fetch target derives from tenant/user input and MUST be guarded. */
const HIGH_RISK_HINTS = [
  /homeserver/i,
  /outboundUrl/,
  /webhook_url/,
  /contextFetchUrl/i,
  /avatarUrl/i,
  /callbackUrl/i,
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "test-stubs") continue;
      walk(full, out);
    } else if (/\.(js|ts)$/.test(entry) && !/\.test\.(js|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Remove comments and template/string literals so prose and generated code do not match. */
function stripNonCode(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1")
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, "``")
    .replace(/'(?:\\.|[^\\'])*'/g, "''")
    .replace(/"(?:\\.|[^\\"])*"/g, '""');
}

function main() {
  const files = walk(workerSrc);
  const violations = [];
  const highRisk = [];
  let guarded = 0;
  let rawAllowed = 0;

  for (const file of files) {
    const rel = relative(workerSrc, file).replace(/\\/g, "/");
    const source = readFileSync(file, "utf8");
    const code = stripNonCode(source);

    const usesGuard = /assertSafeOutboundUrl|safeOutboundFetch/.test(code);
    // `fetch(` not preceded by an identifier char or a dot: excludes
    // `safeOutboundFetch(`, `this.fetch(`, `stub.fetch(`.
    const rawFetches = code.match(/(?<![\w.])fetch\s*\(/g) || [];

    if (usesGuard) guarded++;
    if (!rawFetches.length) continue;

    if (ALLOWLIST.has(rel)) {
      rawAllowed++;
      continue;
    }

    if (usesGuard) {
      // Mixed file: has the guard but also raw calls. Flag the raw ones, since
      // this is exactly the inconsistency that produced the original gap.
      violations.push(
        `${rel}: ${rawFetches.length} raw fetch() call(s) alongside guarded calls — route them through safeOutboundFetch`,
      );
    } else {
      violations.push(
        `${rel}: ${rawFetches.length} raw fetch() call(s) with no SSRF guard in the file`,
      );
    }

    if (HIGH_RISK_HINTS.some((re) => re.test(source))) {
      highRisk.push(rel);
    }
  }

  console.log(
    `outbound-fetch: ${files.length} worker source files, ${guarded} use the SSRF guard, ` +
      `${rawAllowed} allow-listed raw-fetch file(s)`,
  );

  if (violations.length) {
    console.error("\n✗ unguarded outbound fetch detected:");
    for (const v of violations) console.error(`  - ${v}`);
    if (highRisk.length) {
      console.error(
        `\n  HIGH RISK (target derives from tenant/user input): ${highRisk.join(", ")}`,
      );
    }
    console.error(
      "\nFix: import { safeOutboundFetch } from './url-ssrf.js' and use it, or add the\n" +
        "file to ALLOWLIST in scripts/check-outbound-fetch.mjs WITH a reason.",
    );
    process.exit(1);
  }

  console.log("✓ every outbound fetch is guarded or explicitly allow-listed");
}

main();
