import { describe, expect, it } from "vitest";
import { verifyDiscordSignature, verifySlackSignature, hexToBytes } from "./bridge-webhook-verify.js";

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

const SLACK_SECRET = "test-signing-secret";

async function slackSign(timestamp, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(SLACK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`v0:${timestamp}:${body}`));
  return `v0=${bytesToHex(new Uint8Array(mac))}`;
}

describe("verifySlackSignature", () => {
  it("accepts a valid signature", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({ type: "event_callback" });
    const signature = await slackSign(ts, body);
    const res = await verifySlackSignature({ signingSecret: SLACK_SECRET, timestamp: ts, signature, rawBody: body });
    expect(res.ok).toBe(true);
  });

  it("rejects a tampered body", async () => {
    const ts = String(Math.floor(Date.now() / 1000));
    const signature = await slackSign(ts, JSON.stringify({ type: "event_callback" }));
    const res = await verifySlackSignature({
      signingSecret: SLACK_SECRET,
      timestamp: ts,
      signature,
      rawBody: JSON.stringify({ type: "event_callback", extra: "injected" }),
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("bad_signature");
  });

  it("rejects a stale timestamp", async () => {
    const ts = String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000));
    const body = "{}";
    const signature = await slackSign(ts, body);
    const res = await verifySlackSignature({ signingSecret: SLACK_SECRET, timestamp: ts, signature, rawBody: body });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("stale_timestamp");
  });

  it("fails closed without a configured secret", async () => {
    const res = await verifySlackSignature({ signingSecret: null, timestamp: "1", signature: "v0=x", rawBody: "{}" });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("signature_not_configured");
  });
});

describe("verifyDiscordSignature", () => {
  async function makeKeypair() {
    const pair = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
    const publicKey = bytesToHex(new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)));
    return { pair, publicKey };
  }

  it("accepts a valid ed25519 signature", async () => {
    const { pair, publicKey } = await makeKeypair();
    const timestamp = String(Date.now());
    const body = JSON.stringify({ type: 1 });
    const signature = bytesToHex(
      new Uint8Array(
        await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(timestamp + body)),
      ),
    );
    const res = await verifyDiscordSignature({ publicKey, timestamp, signature, rawBody: body });
    expect(res.ok).toBe(true);
  });

  it("rejects a bad signature", async () => {
    const { pair, publicKey } = await makeKeypair();
    const timestamp = String(Date.now());
    const body = JSON.stringify({ type: 1 });
    const sig = new Uint8Array(
      await crypto.subtle.sign({ name: "Ed25519" }, pair.privateKey, new TextEncoder().encode(timestamp + body)),
    );
    sig[0] ^= 0xff;
    const res = await verifyDiscordSignature({
      publicKey,
      timestamp,
      signature: bytesToHex(sig),
      rawBody: body,
    });
    expect(res.ok).toBe(false);
    expect(res.error).toBe("bad_signature");
  });

  it("rejects malformed hex", async () => {
    const res = await verifyDiscordSignature({
      publicKey: "not-hex!!",
      timestamp: "1",
      signature: "abcd",
      rawBody: "{}",
    });
    expect(res.ok).toBe(false);
  });

  it("hexToBytes returns null on odd-length input", () => {
    expect(hexToBytes("abc")).toBeNull();
  });
});
