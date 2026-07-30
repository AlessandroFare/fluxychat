import { describe, it, expect } from "vitest";
import { createBroadcastApi } from "./broadcast";

describe("createBroadcastApi", () => {
  it("creates and retrieves segment", () => {
    const api = createBroadcastApi();
    const seg = api.createSegment("testers", ["u1", "u2"]);
    expect(api.getSegment(seg.id)?.name).toBe("testers");
  });

  it("listSegments returns all", () => {
    const api = createBroadcastApi();
    api.createSegment("a", []);
    api.createSegment("b", []);
    expect(api.listSegments()).toHaveLength(2);
  });

  it("creates broadcast and sends it", () => {
    const api = createBroadcastApi();
    const seg = api.createSegment("testers", ["u1", "u2", "u3"]);
    const bc = api.createBroadcast(seg.id, "Hello everyone!");
    expect(bc.status).toBe("draft");
    api.sendBroadcast(bc.id);
    expect(api.getBroadcast(bc.id)?.status).toBe("completed");
    const stats = api.getDeliveryStats(bc.id);
    expect(stats.delivered).toBe(3);
  });

  it("creates scheduled broadcast", () => {
    const api = createBroadcastApi();
    const seg = api.createSegment("testers", ["u1"]);
    const bc = api.createBroadcast(seg.id, "Later msg", "2026-07-20T10:00:00Z");
    expect(bc.status).toBe("scheduled");
  });
});
