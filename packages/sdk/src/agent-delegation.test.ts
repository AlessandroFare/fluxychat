import { describe, expect, it } from "vitest";
import {
  routeTask,
  createMemorySharedStateStore,
  createHandoffManager,
} from "./agent-delegation";
import { createAgentCommunicationBus, FLUXY_AGENT_PROTOCOL_VERSION } from "./agent-to-agent";
import type { AgentCard } from "./agent-to-agent";

function makeCard(overrides: Partial<AgentCard> & { agentId: string }): AgentCard {
  return {
    version: FLUXY_AGENT_PROTOCOL_VERSION,
    name: overrides.agentId,
    capabilities: [],
    ...overrides,
  };
}

describe("routing", () => {
  const cards: AgentCard[] = [
    makeCard({ agentId: "a1", capabilities: [{ id: "translate" }, { id: "summarize" }], trust: "verified", costTier: "low" }),
    makeCard({ agentId: "a2", capabilities: [{ id: "translate" }], trust: "internal", costTier: "free" }),
    makeCard({ agentId: "a3", capabilities: [{ id: "code" }], trust: "unverified", costTier: "standard" }),
  ];

  it("filters by required capabilities", () => {
    const result = routeTask(cards, { requireCapabilities: ["translate"], maxResults: 10 });
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.card.agentId).sort()).toEqual(["a1", "a2"]);
  });

  it("scores by trust and cost", () => {
    const result = routeTask(cards, { requireCapabilities: ["translate"], maxResults: 10 });
    expect(result[0].card.agentId).toBe("a2");
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it("excludes specified agents", () => {
    const result = routeTask(cards, { requireCapabilities: ["translate"], excludeAgentIds: ["a2"] });
    expect(result).toHaveLength(1);
    expect(result[0].card.agentId).toBe("a1");
  });

  it("enforces maxCost", () => {
    const result = routeTask(cards, { requireCapabilities: ["code"], maxCost: "free" });
    expect(result).toHaveLength(0);
  });

  it("enforces minTrust", () => {
    const result = routeTask(cards, { requireCapabilities: ["translate"], minTrust: "verified", maxResults: 10 });
    expect(result).toHaveLength(2);
    expect(result[0].card.agentId).toBe("a2");
  });

  it("filters out by trust level", () => {
    const result = routeTask(cards, { requireCapabilities: ["code"], minTrust: "internal" });
    expect(result).toHaveLength(0);
  });
});

describe("shared state store", () => {
  it("sets and gets state", async () => {
    const store = createMemorySharedStateStore();
    const state = await store.set("key1", "room-1", { count: 42 }, "agent-1");
    expect(state.version).toBe(1);
    const got = await store.get("key1", "room-1");
    expect(got).not.toBeNull();
    expect(got!.value).toEqual({ count: 42 });
  });

  it("increments version on update", async () => {
    const store = createMemorySharedStateStore();
    await store.set("k", "r", "v1", "owner");
    const v2 = await store.set("k", "r", "v2", "owner");
    expect(v2.version).toBe(2);
  });

  it("delete only by owner", async () => {
    const store = createMemorySharedStateStore();
    await store.set("k", "r", "v", "owner-1");
    expect(await store.delete("k", "r", "owner-2")).toBe(false);
    expect(await store.delete("k", "r", "owner-1")).toBe(true);
  });

  it("lock/unlock", async () => {
    const store = createMemorySharedStateStore();
    expect(await store.lock("resource", "r", "agent-a")).toBe(true);
    expect(await store.lock("resource", "r", "agent-b")).toBe(false);
    await store.unlock("resource", "r", "agent-a");
    expect(await store.lock("resource", "r", "agent-b")).toBe(true);
  });

  it("lists states for a room", async () => {
    const store = createMemorySharedStateStore();
    await store.set("a", "room-1", "va", "owner");
    await store.set("b", "room-1", "vb", "owner");
    await store.set("c", "room-2", "vc", "owner");
    expect((await store.list("room-1")).length).toBe(2);
  });
});

describe("handoff manager", () => {
  it("creates and tracks handoff requests", async () => {
    const bus = createAgentCommunicationBus();
    const manager = createHandoffManager({ bus });
    const req = await manager.requestHandoff({
      roomId: "room-1",
      projectId: "proj-1",
      fromAgentId: "agent-bot",
      toHumanId: "human-alice",
      reason: "need approval",
      context: "sensitive transaction",
    });
    expect(req.status).toBe("pending");
    expect(manager.getPendingForHuman("room-1", "human-alice")).toHaveLength(1);
  });

  it("accepts a handoff", async () => {
    const bus = createAgentCommunicationBus();
    const manager = createHandoffManager({ bus });
    const req = await manager.requestHandoff({
      roomId: "room-1", projectId: "proj-1",
      fromAgentId: "bot", toHumanId: "alice",
      reason: "help", context: "",
    });
    const accepted = await manager.respondToHandoff(req.id, "human-alice", true);
    expect(accepted.status).toBe("accepted");
    expect(manager.getPendingForHuman("room-1", "alice")).toHaveLength(0);
  });

  it("completes a handoff", async () => {
    const bus = createAgentCommunicationBus();
    const manager = createHandoffManager({ bus });
    const req = await manager.requestHandoff({
      roomId: "r", projectId: "p",
      fromAgentId: "bot", toHumanId: "human",
      reason: "test", context: "",
    });
    await manager.respondToHandoff(req.id, "human", true);
    const completed = manager.completeHandoff(req.id);
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe("completed");
  });

  it("lists handoffs by room", async () => {
    const bus = createAgentCommunicationBus();
    const manager = createHandoffManager({ bus });
    await manager.requestHandoff({ roomId: "r1", projectId: "p", fromAgentId: "bot", toHumanId: "h1", reason: "a" });
    await manager.requestHandoff({ roomId: "r1", projectId: "p", fromAgentId: "bot", toHumanId: "h2", reason: "b" });
    await manager.requestHandoff({ roomId: "r2", projectId: "p", fromAgentId: "bot", toHumanId: "h1", reason: "c" });
    expect(manager.listHandoffs("r1")).toHaveLength(2);
    expect(manager.listHandoffs("r2")).toHaveLength(1);
  });
});
