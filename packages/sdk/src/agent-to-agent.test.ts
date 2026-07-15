import { describe, expect, it, vi } from "vitest";
import {
  FLUXY_AGENT_PROTOCOL_VERSION,
  agentTaskToA2A,
  createAgentCommunicationBus,
  delegateToAgent,
} from "./agent-to-agent";

describe("Agent Collaboration Fabric", () => {
  it("discovers non-expired agents by capability", () => {
    const bus = createAgentCommunicationBus();
    bus.registerCard({
      version: FLUXY_AGENT_PROTOCOL_VERSION,
      agentId: "researcher",
      name: "Researcher",
      capabilities: [{ id: "web-research" }],
      trust: "internal",
    });
    expect(bus.discover("web-research").map((card) => card.agentId)).toEqual(["researcher"]);
    expect(bus.discover("billing")).toEqual([]);
  });

  it("delivers ordered messages and resumes history from an offset", async () => {
    const handler = { handle: vi.fn().mockResolvedValue(null) };
    let id = 0;
    const bus = createAgentCommunicationBus({ createId: () => `id-${++id}` });
    bus.registerHandler("target", handler);
    await bus.send({ fromAgentId: "source", toAgentId: "target", roomId: "room", projectId: "project", type: "query", content: "one" });
    await bus.send({ fromAgentId: "source", toAgentId: "target", roomId: "room", projectId: "project", type: "query", content: "two" });
    expect(handler.handle).toHaveBeenCalledTimes(2);
    expect((await bus.getHistory("room", 100, 1)).map((message) => message.content)).toEqual(["two"]);
  });

  it("deduplicates delegation and enforces terminal task state", async () => {
    let id = 0;
    const bus = createAgentCommunicationBus({ createId: () => `id-${++id}` });
    const input = { idempotencyKey: "effect-1", depth: 0 };
    const first = await delegateToAgent(bus, "planner", "worker", "room", "project", "inspect", input);
    const duplicate = await delegateToAgent(bus, "planner", "worker", "room", "project", "inspect", input);
    expect(duplicate.id).toBe(first.id);
    const working = bus.updateTask(first.id, "working");
    const completed = bus.updateTask(first.id, "completed", {
      artifact: { id: "artifact", mediaType: "application/json", data: { ok: true }, createdBy: "worker", createdAt: new Date().toISOString() },
    });
    expect(working.offset).toBeLessThan(completed.offset);
    expect(agentTaskToA2A(completed)).toMatchObject({ id: first.id, status: { state: "completed" } });
    expect(() => bus.cancelTask(first.id)).toThrow(/terminal/);
  });

  it("rejects delegation beyond the configured depth", async () => {
    const bus = createAgentCommunicationBus({ maxDelegationDepth: 1 });
    await expect(delegateToAgent(bus, "a", "b", "room", "project", "task", { depth: 2 })).rejects.toThrow(/depth/);
  });
});
