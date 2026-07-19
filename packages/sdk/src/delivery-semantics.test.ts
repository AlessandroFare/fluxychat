import { describe, it, expect } from "vitest";
import { createDeliverySemantics } from "./delivery-semantics";

describe("createDeliverySemantics", () => {
  it("sends with at-most-once semantic", () => {
    const d = createDeliverySemantics();
    const r = d.send("at-most-once", "msg-1", "consumer-1", "hello");
    expect(r.semantic).toBe("at-most-once");
    expect(r.stage).toBe("accepted");
  });

  it("sends with exactly-once semantic", () => {
    const d = createDeliverySemantics();
    const r = d.send("exactly-once", "msg-2", "consumer-1", "data");
    expect(r.semantic).toBe("exactly-once");
  });

  it("isDuplicate returns true for repeated idempotency key", () => {
    const d = createDeliverySemantics();
    const r = d.send("at-least-once", "msg-1", "consumer-1", "data");
    expect(d.isDuplicate(r.idempotencyKey)).toBe(true);
  });

  it("acknowledge updates stage", () => {
    const d = createDeliverySemantics();
    const r = d.send("at-least-once", "msg-1", "consumer-1", "data");
    const ack = d.acknowledge(r.idempotencyKey, "delivered");
    expect(ack?.stage).toBe("delivered");
  });

  it("getReceipt returns null for unknown", () => {
    const d = createDeliverySemantics();
    expect(d.getReceipt("unknown")).toBeNull();
  });

  it("getDedupStats returns counts", () => {
    const d = createDeliverySemantics();
    d.send("at-least-once", "m1", "c1", "a");
    d.send("at-least-once", "m2", "c1", "b");
    const stats = d.getDedupStats();
    expect(stats.total).toBe(2);
  });

  it("reset clears all state", () => {
    const d = createDeliverySemantics();
    d.send("at-least-once", "m1", "c1", "a");
    d.reset();
    expect(d.getDedupStats().total).toBe(0);
  });
});
