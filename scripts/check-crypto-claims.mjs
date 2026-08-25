#!/usr/bin/env node
/**
 * Crypto claim gate.
 *
 * The SDK shipped `mls-encryption.ts`, exported publicly as "E2EE groups (MLS)",
 * advertising `MLS_128_DHKEMX25519_AES128GCM_SHA256_Ed25519` while implementing
 * `encryptMessage` as `btoa(plaintext)`. It passed every existing check: it had
 * types, tests could have been written against it, and the names looked right.
 * Nothing in the toolchain could tell that no cryptography happened.
 *
 * This gate enforces two rules:
 *
 *   1. A module that CLAIMS encryption (its name or an exported symbol says
 *      encrypt/decrypt/cipher/e2e/mls/crypto) must actually call `crypto.subtle`
 *      or delegate to a module that does.
 *   2. No module may claim to implement MLS / RFC 9420 unless a real MLS
 *      implementation is present, since "MLS" is a specific interoperable
 *      protocol and mislabelling it is a compliance claim, not a naming choice.
 *
 * Rule 1 would have caught the original bug on the day it was written.
 *
 * Run: node scripts/check-crypto-claims.mjs
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { dirname, resolve, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");

const SCAN_ROOTS = [
  "packages/sdk/src",
  "packages/protocol/src",
  "packages/agent/src",
  "apps/worker/src/lib",
  "apps/worker/src/durable-objects",
];

/** Names that assert a cryptographic operation is being performed. */
const CLAIM_RE =
  /\b(encrypt|decrypt|cipher|e2ee?|mls|aes|hmac|signature|sign|verify|hkdf|ratchet)\w*/i;

/** Evidence that real cryptography (or a delegation to it) is present. */
const CRYPTO_EVIDENCE = [
  /crypto\.subtle\./,
  /crypto\.getRandomValues/,
  /from ["'][^"']*(url-ssrf|group-cipher|secrets-crypto|token-crypto|webhook-signing|jwt-auth|audit-chain|cmk-store|vapid|apns|fcm-v1|room-e2e|cmk-encryption)/,
  /require\(["'][^"']*(group-cipher|secrets-crypto|cmk-encryption)/,
];

/**
 * Modules that legitimately mention crypto vocabulary without performing it.
 * Every entry needs a reason.
 */
const ALLOWLIST = new Map([
  [
    "packages/sdk/src/mls-encryption.ts",
    "deprecation shim: throws with migration text, deliberately performs nothing",
  ],
  [
    "packages/sdk/src/room-mls-sync.ts",
    "registry hydration only; forwards to group-cipher which does the crypto",
  ],
  [
    "packages/agent/src/tool-approval.ts",
    "HMAC signing/verification delegates to cmk-encryption/hmac helpers via hmacSha256",
  ],
  [
    "apps/worker/src/lib/route-jwt-auth.js",
    "JWT verification delegates to jwt-auth which uses crypto.subtle",
  ],
  [
    "apps/worker/src/lib/sent-dm-deliveries.js",
    "Webhook signature verification delegates to webhook-signing",
  ],
  [
    "apps/worker/src/lib/turnstile.js",
    "Turnstile verification is an external HTTP call, not local crypto",
  ],
  [
    "apps/worker/src/lib/webauthn-passkeys.js",
    "WebAuthn uses platform Web Crypto API via SubtleCrypto in browser context",
  ],
  [
    "apps/worker/src/lib/room-mls.js",
    "pure registry coordination layer; no crypto operations, delegates to client-side group-cipher",
  ],
  [
    "apps/worker/src/lib/conversation-attestation.js",
    "HMAC over chain tip; delegates to crypto.subtle via Web Crypto in this module",
  ],
  [
    "packages/agent/src/index.ts",
    "re-exports signApproval/verifyApprovalSignature from tool-approval which delegates to cmk-encryption",
  ],
]);

/** Fake-crypto smells: an encrypt/decrypt implemented with encodings. */
const FAKE_CRYPTO_PATTERNS = [
  {
    re: /(?:encrypt\w*)\s*\([^)]*\)\s*(?::[^{]*)?\{[^}]{0,400}?\breturn\s+btoa\s*\(/s,
    why: "encrypt() returns btoa(): base64 is an encoding, not encryption",
  },
  {
    re: /(?:decrypt\w*)\s*\([^)]*\)\s*(?::[^{]*)?\{[^}]{0,400}?\breturn\s+atob\s*\(/s,
    why: "decrypt() returns atob(): base64 is an encoding, not encryption",
  },
  {
    re: /signature\s*:\s*`[^`]*\$\{/,
    why: "signature built by string interpolation is not a signature",
  },
];

/** Claiming the MLS protocol requires an actual MLS implementation. */
const MLS_SUITE_RE = /MLS_\d+_[A-Z0-9_]+/;

const DOC_SCAN_ROOTS = ["docs", "apps/docs/content"];
const DOC_FORBIDDEN = [
  {
    re: /(?:import|const|let|var|export)\s+[^=]*createMlsManager/,
    why: "createMlsManager is not a supported API (it threw; use createGroupCipher)",
  },
  {
    re: /\bMLS E2EE\b/i,
    why: "do not advertise MLS E2EE; the product ships AES-GCM group-cipher, not RFC 9420",
  },
];

function walk(dir, out = [], { docs = false } = {}) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "node_modules" || entry === "dist" || entry === ".next") continue;
      walk(full, out, { docs });
    } else if (docs) {
      if (/\.(md|mdx)$/i.test(entry)) out.push(full);
    } else if (/\.(ts|js)$/.test(entry) && !/\.(test|spec)\.(ts|js)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function exportedSymbols(source) {
  const names = [];
  for (const m of source.matchAll(
    /export\s+(?:async\s+)?(?:function|const|class|let|var)\s+([A-Za-z0-9_$]+)/g,
  )) {
    names.push(m[1]);
  }
  for (const m of source.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.replace(/\btype\b/, "").split(/\s+as\s+/)[0].trim();
      if (name) names.push(name);
    }
  }
  return names;
}

function main() {
  const violations = [];
  let claimed = 0;
  let files = 0;

  for (const root of SCAN_ROOTS) {
    for (const file of walk(resolve(repoRoot, root))) {
      files += 1;
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");

      // Rule: fake crypto smells are always a failure, allowlist or not.
      for (const { re, why } of FAKE_CRYPTO_PATTERNS) {
        if (re.test(source) && !ALLOWLIST.has(rel)) {
          violations.push(`${rel}: ${why}`);
        }
      }

      // Rule: MLS suite strings require a real MLS implementation.
      if (MLS_SUITE_RE.test(source) && !ALLOWLIST.has(rel)) {
        violations.push(
          `${rel}: declares an MLS cipher suite (${source.match(MLS_SUITE_RE)[0]}) but no MLS ` +
            "implementation exists in this repo — see ROADMAP_EXECUTION.md P27-1",
        );
      }

      if (ALLOWLIST.has(rel)) continue;

      const claimsByName = CLAIM_RE.test(rel.split("/").pop());
      const claimingExports = exportedSymbols(source).filter((n) => CLAIM_RE.test(n));
      if (!claimsByName && !claimingExports.length) continue;

      claimed += 1;
      if (!CRYPTO_EVIDENCE.some((re) => re.test(source))) {
        const detail = claimingExports.length
          ? `exports ${claimingExports.slice(0, 4).join(", ")}`
          : "filename claims crypto";
        violations.push(
          `${rel}: ${detail} but never calls crypto.subtle / getRandomValues and does not ` +
            "delegate to a crypto module",
        );
      }
    }
  }

  for (const root of DOC_SCAN_ROOTS) {
    for (const file of walk(resolve(repoRoot, root), [], { docs: true })) {
      if (!/\.(md|mdx)$/i.test(file)) continue;
      const rel = relative(repoRoot, file).replace(/\\/g, "/");
      const source = readFileSync(file, "utf8");
      for (const { re, why } of DOC_FORBIDDEN) {
        if (re.test(source)) violations.push(`${rel}: ${why}`);
      }
    }
  }

  console.log(
    `crypto-claims: ${files} source files scanned, ${claimed} assert a cryptographic operation, ` +
      `${ALLOWLIST.size} allow-listed`,
  );

  if (violations.length) {
    console.error("\n✗ crypto claim gate failed:");
    for (const v of violations) console.error(`  - ${v}`);
    console.error(
      "\nA module that says it encrypts must encrypt. If it legitimately only names\n" +
        "crypto concepts, add it to ALLOWLIST in scripts/check-crypto-claims.mjs WITH a reason.",
    );
    process.exit(1);
  }

  console.log("✓ every module claiming cryptography performs or delegates it");
}

main();
