import { describe, it, expect } from "vitest";
import { createA2AClient } from "./a2a-protocol";

describe("createA2AClient", () => {
  it("creates a task in pending status", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "Translate", input: { text: "hello" } });
    expect(task.status).toBe("pending");
    expect(task.artifacts).toEqual([]);
  });

  it("getTask returns task by id", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    const got = a2a.getTask(task.id);
    expect(got).toBeDefined();
    expect(got!.title).toBe("T");
  });

  it("listTasks returns all tasks", () => {
    const a2a = createA2AClient();
    a2a.createTask({ title: "A", input: {} });
    a2a.createTask({ title: "B", input: {} });
    expect(a2a.listTasks()).toHaveLength(2);
  });

  it("sendEnvelope and receiveEnvelope deliver messages", () => {
    const a2a = createA2AClient();
    a2a.sendEnvelope({ source: "agent-a", target: "agent-b", taskId: "t1", status: "pending", extensions: {} });
    const msgs = a2a.receiveEnvelope("agent-b");
    expect(msgs).toHaveLength(1);
    expect(msgs[0].source).toBe("agent-a");
  });

  it("receiveEnvelope clears queue", () => {
    const a2a = createA2AClient();
    a2a.sendEnvelope({ source: "a", target: "b", taskId: "t1", status: "pending", extensions: {} });
    a2a.receiveEnvelope("agent-b");
    expect(a2a.receiveEnvelope("agent-b")).toHaveLength(0);
  });

  it("acknowledgeTask sets status to working", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    const updated = a2a.acknowledgeTask(task.id);
    expect(updated.status).toBe("working");
  });

  it("completeTask sets status to completed with output", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    const updated = a2a.completeTask(task.id, { result: "done" });
    expect(updated.status).toBe("completed");
    expect(updated.output).toEqual({ result: "done" });
  });

  it("failTask sets status to failed", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    const updated = a2a.failTask(task.id, "timeout");
    expect(updated.status).toBe("failed");
    expect(updated.output).toEqual({ error: "timeout" });
  });

  it("cancelTask sets status to cancelled", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    expect(a2a.cancelTask(task.id).status).toBe("cancelled");
  });

  it("addArtifact adds artifact to task", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    const art = a2a.addArtifact(task.id, { name: "output.txt", mimeType: "text/plain", data: "hello", extensions: {} });
    expect(art.id).toMatch(/art-/);
    expect(art.name).toBe("output.txt");
  });

  it("preserveExtensions stores extensions as artifact", () => {
    const a2a = createA2AClient();
    const task = a2a.createTask({ title: "T", input: {} });
    a2a.preserveExtensions(task.id, { version: "1.0" });
    const t = a2a.getTask(task.id)!;
    expect(t.artifacts.some((a) => a.name === "_extensions")).toBe(true);
  });
});
