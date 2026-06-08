import { signWebhookPayload } from "./webhook-signing.js";
import { timingSafeEqual } from "./crypto-timing.js";

const MAX_BATCH_EVENTS = 50;

/**
 * Normalize signature header (Fluxy or Pusher alias).
 * @param {string | undefined | null} signature
 */
export function normalizeWebhookSignature(signature) {
  if (!signature || typeof signature !== "string") return "";
  const trimmed = signature.trim();
  if (trimmed.startsWith("sha256=")) return trimmed;
  return `sha256=${trimmed}`;
}

/**
 * @param {string} secret
 * @param {string} payloadString raw body bytes as string
 * @param {string} receivedSignature
 */
export async function verifyWebhookSignature(secret, payloadString, receivedSignature) {
  if (!secret || !payloadString || !receivedSignature) {
    return { valid: false, reason: "missing_inputs" };
  }
  const expected = await signWebhookPayload(secret, payloadString);
  const expectedHex = expected.replace(/^sha256=/, "");
  const receivedHex = normalizeWebhookSignature(receivedSignature).replace(/^sha256=/, "");
  const valid = await timingSafeEqual(expectedHex, receivedHex);
  return { valid, expected: expected };
}

/**
 * Verify an array of outbound-style event payloads with one shared signature over the batch body.
 * Pusher-compatible: HMAC-SHA256(secret, JSON.stringify(events)).
 *
 * @param {string} secret
 * @param {unknown[]} events
 * @param {string} [batchSignature]
 */
export async function verifyWebhookEventBatch(secret, events, batchSignature) {
  if (!Array.isArray(events) || events.length === 0) {
    return { valid: false, error: "events_required", results: [] };
  }
  if (events.length > MAX_BATCH_EVENTS) {
    return { valid: false, error: "too_many_events", max: MAX_BATCH_EVENTS, results: [] };
  }

  const body = JSON.stringify(events);
  const batchResult = batchSignature
    ? await verifyWebhookSignature(secret, body, batchSignature)
    : { valid: true };

  const results = [];
  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const payloadString =
      typeof event === "string"
        ? event
        : typeof event?.payload === "string"
          ? event.payload
          : JSON.stringify(event?.payload ?? event);
    const perEventSig =
      typeof event === "object" && event && typeof event.signature === "string"
        ? event.signature
        : null;
    if (perEventSig) {
      const r = await verifyWebhookSignature(secret, payloadString, perEventSig);
      results.push({ index: i, valid: r.valid });
    } else {
      results.push({ index: i, valid: batchResult.valid, usesBatchSignature: true });
    }
  }

  const allValid = results.every((r) => r.valid);
  return {
    valid: allValid && batchResult.valid,
    batchSignatureValid: batchResult.valid,
    body,
    results,
  };
}
