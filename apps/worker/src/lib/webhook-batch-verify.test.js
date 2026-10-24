import { describe, it, expect } from "vitest";
import {
  normalizeWebhookSignature,
  verifyWebhookSignature,
  verifyWebhookEventBatch,
} from "./webhook-batch-verify.js";
import { signWebhookPayload } from "./webhook-signing.js";

describe("webhook-batch-verify", () => {
  it("normalizes signatures", () => {
    expect(normalizeWebhookSignature("abc")).toBe("sha256=abc");
    expect(normalizeWebhookSignature("sha256=abc")).toBe("sha256=abc");
  });

  it("verifies single payload", async () => {
    const payload = JSON.stringify({ type: "message.created", id: 1 });
    const sig = await signWebhookPayload("test-secret", payload);
    const result = await verifyWebhookSignature("test-secret", payload, sig);
    expect(result.valid).toBe(true);
  });

  it("verifies batch with shared signature", async () => {
    const events = [{ type: "a" }, { type: "b" }];
    const body = JSON.stringify(events);
    const sig = await signWebhookPayload("batch-secret", body);
    const result = await verifyWebhookEventBatch("batch-secret", events, sig);
    expect(result.valid).toBe(true);
    expect(result.results).toHaveLength(2);
  });

  it("rejects unsigned events without a batch signature (#23)", async () => {
    const events = [{ type: "a" }, { type: "b" }];
    const result = await verifyWebhookEventBatch("batch-secret", events);
    expect(result.valid).toBe(false);
    expect(result.batchSignatureValid).toBe(false);
    expect(result.results.every((r) => r.valid === false)).toBe(true);
  });

  it("accepts unsigned events only when each carries its own signature", async () => {
    const a = { type: "a" };
    const b = { type: "b" };
    const events = [
      { payload: JSON.stringify(a), signature: await signWebhookPayload("s", JSON.stringify(a)) },
      { payload: JSON.stringify(b), signature: await signWebhookPayload("s", JSON.stringify(b)) },
    ];
    const result = await verifyWebhookEventBatch("s", events);
    expect(result.valid).toBe(true);
  });
});
