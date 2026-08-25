/**
 * F4 — Offline attestation verifier for third parties.
 *
 * Ships in the public SDK so a customer (or their auditor) can prove that a
 * conversation range is intact and that FluxyChat signed exactly that tip,
 * WITHOUT any FluxyChat infrastructure: no server calls, no database, just
 * WebCrypto.
 *
 * Pair with `GET /rooms/:id/attestation` on the Worker, which returns
 * `{ attestation, entries }` — feed both straight into `verifyAttestation`.
 *
 * Trust model (read this before relying on it):
 *   - Hash linkage proves the entries form one unbroken chain whose tip was
 *     committed at signing time.
 *   - The HMAC proves FLUXYCHAT endorsed that tip. It does not make us
 *     trustworthy; it makes later inconsistency detectable. For trust-free
 *     anchoring, publish `attestation.attestationHash` to an external
 *     timestamp service.
 */

export const ATTESTATION_VERSION = 1;

function bytesToHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input: string): Promise<string> {
  const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return bytesToHex(data);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

/** Canonical JSON (sorted keys) — must match the signer byte-for-byte. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(",")}}`;
}

export interface AttestationHeader {
  version: number;
  projectId: string;
  roomId: string;
  eventCount: number;
  firstEventId: number | string | null;
  lastEventId: number | string | null;
  firstEventHash: string | null;
  chainTipHash: string | null;
  generatedAt: string;
  attestationHash?: string;
  algorithm?: string;
  signature?: string;
}

export interface AttestationEntry {
  id: number | string;
  prevHash: string;
  eventHash: string;
  createdAt?: string;
}

export type VerifyReason =
  | `mismatch:${string}`
  | `linkage_broken:index:${number}`
  | "signature_invalid"
  | "signature_not_checked:no_key"
  | "entries_required"
  | "attestation_required";

/** The exact byte-string whose HMAC is the signature. */
export function attestationSigningPayload(header: AttestationHeader): string {
  return canonicalJson({ ...header, __purpose: "fluxychat-conversation-attestation/v1" });
}

/**
 * Verify an exported conversation bundle offline.
 *
 * @param input.entries    raw entries from the export endpoint
 * @param input.attestation signed header produced by the Worker
 * @param input.signingKey optional shared HMAC key; when provided the signature
 *   is checked, otherwise chain + header integrity are still verified and the
 *   reason list contains the informational `signature_not_checked:no_key`.
 */
export async function verifyAttestation(input: {
  entries: AttestationEntry[];
  attestation: AttestationHeader;
  signingKey?: string;
}): Promise<{ ok: boolean; reasons: VerifyReason[] }> {
  const { entries, attestation } = input;
  const reasons: VerifyReason[] = [];

  if (!Array.isArray(entries) || entries.length === 0) {
    return { ok: false, reasons: ["entries_required"] };
  }
  if (!attestation || typeof attestation !== "object") {
    return { ok: false, reasons: ["attestation_required"] };
  }

  // 1. Rebuild every header field from the entries themselves.
  const first = entries[0];
  const last = entries[entries.length - 1];
  const rebuilt: AttestationHeader = {
    version: attestation.version,
    projectId: attestation.projectId,
    roomId: attestation.roomId,
    eventCount: entries.length,
    firstEventId: first?.id ?? null,
    lastEventId: last?.id ?? null,
    firstEventHash: first?.eventHash ?? null,
    chainTipHash: last?.eventHash ?? null,
    generatedAt: attestation.generatedAt,
  };

  const fields: Array<keyof AttestationHeader> = [
    "eventCount",
    "firstEventId",
    "lastEventId",
    "firstEventHash",
    "chainTipHash",
  ];
  for (const field of fields) {
    if (rebuilt[field] !== attestation[field]) {
      reasons.push(`mismatch:${field}` as VerifyReason);
    }
  }

  // 2. Recompute the full hash-chain linkage from genesis.
  let prevHash = "genesis";
  for (let i = 0; i < entries.length; i += 1) {
    const e = entries[i];
    if (!e || e.prevHash !== prevHash) {
      reasons.push(`linkage_broken:index:${i}`);
      break;
    }
    prevHash = e.eventHash;
  }

  // 3. Signature (only meaningful with the issuer's key).
  if (typeof input.signingKey === "string" && input.signingKey.length >= 16) {
    const payload = attestationSigningPayload(rebuilt);
    const expectedSig = await hmacSha256Hex(input.signingKey, payload);
    if (expectedSig !== attestation.signature) reasons.push("signature_invalid");
    const expectedHash = await sha256Hex(payload);
    if (expectedHash !== attestation.attestationHash) {
      reasons.push("signature_invalid");
    }
  } else {
    reasons.push("signature_not_checked:no_key");
  }

  const hard = reasons.filter((r) => r !== "signature_not_checked:no_key");
  return { ok: hard.length === 0, reasons };
}