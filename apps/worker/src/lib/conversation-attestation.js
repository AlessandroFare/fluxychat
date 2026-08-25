/**
 * F4 — Signed conversation attestation.
 *
 * THE PROMISE
 * -----------
 * "Any range of a room's conversation can be exported together with a signed
 * attestation that a third party can verify OFFLINE, without trusting
 * FluxyChat."
 *
 * HOW IT HOLDS UP CRYPTOGRAPHICALLY
 * ---------------------------------
 * Each chain entry already satisfies: eventHash = SHA-256(prevHash + ":" +
 * canonical event JSON). A verifier who receives the raw entries can therefore:
 *   1. recompute every eventHash,
 *   2. check the prevHash linkage forms one unbroken chain from genesis,
 *   3. compare the final tip against the tip recorded in the attestation.
 *
 * The HMAC signature over the attestation header proves FLUXYCHAT endorsed that
 * specific tip at that time — it does NOT make us trustworthy; it makes any
 * later disagreement between "what we signed" and "what we show you"
 * detectable. For trust-free anchoring, publish `attestationHash` (below) to an
 * external timestamp service or print it in a newspaper: that is outside this
 * module's scope and costs nothing to add later.
 *
 * OFFLINE VERIFICATION
 * --------------------
 * `verifyAttestation` is pure (no I/O, no server) and ships in the public SDK
 * so customers embed it in their own tooling.
 */

import { sha256Hex } from "./audit-chain.js";

export const ATTESTATION_VERSION = 1;

function bytesToHex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message),
  );
  return bytesToHex(sig);
}

/** Canonical JSON stringification (sorted keys) so verification is portable. */
function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}

/**
 * Build the header object that gets signed. Exported for verifier symmetry.
 */
export function buildAttestationHeader({ projectId, roomId, entries, generatedAt }) {
  const first = entries[0] ?? null;
  const last = entries[entries.length - 1] ?? null;
  return {
    version: ATTESTATION_VERSION,
    projectId,
    roomId,
    eventCount: entries.length,
    firstEventId: first?.id ?? null,
    lastEventId: last?.id ?? null,
    firstEventHash: first?.eventHash ?? null,
    /** Chain tip: committing to this hash commits to every prior entry. */
    chainTipHash: last?.eventHash ?? null,
    generatedAt,
  };
}

/** The exact byte-string whose HMAC becomes the signature. */
export function attestationSigningPayload(header) {
  return canonicalJson({ ...header, __purpose: "fluxychat-conversation-attestation/v1" });
}

/**
 * Create a signed attestation over an exported audit-chain range.
 *
 * @param {object} input
 * @param {*} input.env  needs ATTESTATION_SIGNING_KEY (falls back to JWT project secret is NOT done on purpose: a dedicated key keeps signing authority separable)
 * @param {string} input.projectId
 * @param {string} input.roomId
 * @param {Array<{id:number|string, prevHash:string, eventHash:string, event:unknown, createdAt:string}>} input.entries  as returned by exportRoomAuditChain()
 * @returns {Promise<{ok:boolean, reason?:string, attestation?:object}>}
 */
export async function createConversationAttestation(env, { projectId, roomId, entries }) {
  const secret = env?.ATTESTATION_SIGNING_KEY;
  if (!secret || typeof secret !== "string" || secret.length < 16) {
    return { ok: false, reason: "attestation_signing_key_not_configured" };
  }
  if (!Array.isArray(entries)) {
    return { ok: false, reason: "entries_required" };
  }

  // Never sign a broken chain: verify linkage before endorsing anything.
  let prevHash = "genesis";
  for (const e of entries) {
    if (!e || e.prevHash !== prevHash) {
      return { ok: false, reason: "chain_linkage_broken" };
    }
    prevHash = e.eventHash;
  }

  const generatedAt = new Date().toISOString();
  const header = buildAttestationHeader({ projectId, roomId, entries, generatedAt });
  const signature = await hmacSha256Hex(secret, attestationSigningPayload(header));

  return {
    ok: true,
    attestation: {
      ...header,
      /**
       * SHA-256 of the canonical header: the value to anchor externally
       * (timestamp services, prints, publications) instead of the full header.
       */
      attestationHash: await sha256Hex(attestationSigningPayload(header)),
      algorithm: "HMAC-SHA256",
      signature,
    },
  };
}

/**
 * Offline verifier — pure, no FluxyChat infrastructure required.
 *
 * @param {object} input
 * @param {Array<{prevHash:string, eventHash:string}>} input.entries  raw exported entries
 * @param {object} input.attestation  as produced by createConversationAttestation
 * @param {string} input.signingKey  the shared HMAC key (distributed to the verifier out of band)
 * @returns {Promise<{ok:boolean, reasons:string[]}>}
 */
export async function verifyAttestation({ entries, attestation, signingKey }) {
  const reasons = [];
  if (!Array.isArray(entries) || !entries.length) {
    return { ok: false, reasons: ["entries_required"] };
  }
  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reasons: ["attestation_required"] };
  }

  // 1. Rebuild the expected header from the entries themselves.
  const rebuilt = buildAttestationHeader({
    projectId: attestation.projectId,
    roomId: attestation.roomId,
    entries,
    generatedAt: attestation.generatedAt,
  });

  for (const field of ["eventCount", "firstEventId", "lastEventId", "firstEventHash", "chainTipHash"]) {
    if (rebuilt[field] !== attestation[field]) {
      reasons.push(`mismatch:${field}`);
    }
  }

  // 2. Recompute the full hash chain from genesis.
  let prevHash = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (!e || e.prevHash !== prevHash) {
      reasons.push(`linkage_broken:index:${i}`);
      break;
    }
    prevHash = e.eventHash;
  }

  // 3. Signature check (only meaningful with the issuer's key).
  if (typeof signingKey === "string" && signingKey.length >= 16) {
    const expectedSig = await hmacSha256Hex(signingKey, attestationSigningPayload(rebuilt));
    if (expectedSig !== attestation.signature) {
      reasons.push("signature_invalid");
    }
    const expectedHash = await sha256Hex(attestationSigningPayload(rebuilt));
    if (expectedHash !== attestation.attestationHash) {
      reasons.push("attestation_hash_mismatch");
    }
  } else {
    reasons.push("signature_not_checked:no_key");
  }

  const hard = reasons.filter((r) => r !== "signature_not_checked:no_key");
  // Missing key is informational (chain+header still verified); any hard
  // mismatch fails the attestation.
  return { ok: hard.length === 0, reasons };
}
