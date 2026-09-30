import { describe, expect, it } from "vitest";
import { drainRoomAgentSteer, injectRoomAgentSteer, requestRoomAgentStop, consumeRoomAgentStop } from "./room-agent-steer.js";

function memoryKv() {
  const bag = new Map();
  return {
    get: async (k) => bag.get(k) ?? null,
    put: async (k, v) => bag.set(k, v),
    delete: async (k) => bag.delete(k),
  };
}

describe("room-agent-steer", () => {
  it("queues inject text and drains once", async () => {
    const env = { RATE_LIMIT_KV: memoryKv() };
    await injectRoomAgentSteer(env, { projectId: "p", roomId: "r", userId: "u", content: "wait, change the SKU" });
    const first = await drainRoomAgentSteer(env, "p", "r");
    expect(first).toEqual(["wait, change the SKU"]);
    expect(await drainRoomAgentSteer(env, "p", "r")).toEqual([]);
  });

  it("records a cross-device stop flag", async () => {
    const env = { RATE_LIMIT_KV: memoryKv() };
    await requestRoomAgentStop(env, { projectId: "p", roomId: "r", userId: "admin" });
    expect(await consumeRoomAgentStop(env, "p", "r")).toBe(true);
    expect(await consumeRoomAgentStop(env, "p", "r")).toBe(false);
  });
});
