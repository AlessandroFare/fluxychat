/**
 * F4 offline verifier — SDK-side tests.
 *
 * These mirror the Worker-side suite but run against the PUBLIC export, proving
 * the third-party story end to end: bundle from the REST endpoint in, verdict
 * out, zero server involvement.
 */
import { describe, expect, it } from "vitest";
import {
  verifyAttestation,
  attestationSigningPayload,
  type AttestationEntry,
  type AttestationHeader,
} from "./attestation-verify.js";

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const KEY = "audit-key-0123456789abcdef";

/** Builds a genuine hash-linked chain (same rule as the Worker audit-chain). */
async function makeChain(n: number): Promise<AttestationEntry[]> {
  const entries: AttestationEntry[] = [];
  let prev = "genesis";
  for (let i = 1; i <= n; i += 1) {
    const eventJson = JSON.stringify({ seq: i, body: `e-${i}` });
    const eventHash = await sha256Hex(`${prev}:${eventJson}`);
    entries.push({ id: i, prevHash: prev, eventHash });
    prev = eventHash;
  }
  return entries;
}

function headerFor(entries: AttestationEntry[], generatedAt = "2026-08-24T00:00:00Z"): AttestationHeader {
  return {
    version: 1,
    projectId: "p1",
    roomId: "r1",
    eventCount: entries.length,
    firstEventId: entries[0]?.id ?? null,
    lastEventId: entries[entries.length - 1]?.id ?? null,
    firstEventHash: entries[0]?.eventHash ?? null,
    chainTipHash: entries[entries.length - 1]?.eventHash ?? null,
    generatedAt,
  };
}

describe("SDK verifyAttestation — third-party offline flow", () => {
  it("verifies an honest bundle with signature", async () => {
    const entries = await makeChain(4);
    const header = headerFor(entries);
    const payload = attestationSigningPayload(header);
    // Sign exactly like the Worker does.
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(KEY),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sigBytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
    const signature = [...new Uint8Array(sigBytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const attestationHash = await sha256Hex(payload);

    const attestation: AttestationHeader = { ...header, attestationHash, signature };
    const verdict = await verifyAttestation({ entries, attestation, signingKey: KEY });

    expect(verdict.ok).toBe(true);
    expect(verdict.reasons).toEqual([]);
  });

  it("rejects a forged tip even though linkage of kept entries is fine", async () => {
    const entries = await makeChain(3);
    const attestation = { ...headerFor(entries), chainTipHash: "deadbeef" };

    const verdict = await verifyAttestation({ entries, attestation });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toContain("mismatch:chainTipHash");
  });

  it("flags a broken link at its index", async () => {
    const entries = await makeChain(3);
    const spliced = entries.map((e, i) => (i === 1 ? { ...e, prevHash: "forged" } : e));
    const verdict = await verifyAttestation({
      entries: spliced,
      attestation: headerFor(spliced),
      signingKey: KEY,
    });
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons.some((r) => r.startsWith("linkage_broken:index:1"))).toBe(true);
  });

  it("informational no-key mode still validates structure", async () => {
    const entries = await makeChain(2);
    const verdict = await verifyAttestation({ entries, attestation: headerFor(entries) });
    expect(verdict.ok).toBe(true);
    expect(verdict.reasons).toEqual(["signature_not_checked:no_key"]);
  });

  it("handles empty and malformed input without throwing", async () => {
    expect((await verifyAttestation({ entries: [], attestation: {} as AttestationHeader })).ok).toBe(false);
    expect(
      (await verifyAttestation({ entries: await makeChain(1), attestation: null as unknown as AttestationHeader })).ok,
    ).toBe(false);
  });
});