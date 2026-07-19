import { describe, it, expect } from "vitest";
import {
  createThreadStateStore,
  createThreadState,
  THREAD_STATE_TTL_MS,
} from "./thread-state";

describe("ThreadStateStore", () => {
  it("stores and retrieves state", async () => {
    const store = createThreadStateStore();
    await store.set("thread:1", { mode: "agent", count: 5 });
    const result = await store.get("thread:1");
    expect(result).not.toBeNull();
    expect(result!.threadId).toBe("thread:1");
    expect(result!.state).toEqual({ mode: "agent", count: 5 });
  });

  it("returns null for unknown thread", async () => {
    const store = createThreadStateStore();
    expect(await store.get("thread:unknown")).toBeNull();
  });

  it("deletes state", async () => {
    const store = createThreadStateStore();
    await store.set("thread:1", { key: "value" });
    await store.delete("thread:1");
    expect(await store.get("thread:1")).toBeNull();
  });

  it("supports generics", async () => {
    interface AgentState {
      mode: "chat" | "agent";
      count: number;
    }
    const store = createThreadStateStore<AgentState>();
    await store.set("thread:1", { mode: "agent", count: 3 });
    const result = await store.get("thread:1");
    expect(result!.state.mode).toBe("agent");
  });

  it("expires entries after TTL", async () => {
    const store = createThreadStateStore();
    await store.set("thread:1", { data: "temp" }, 10);
    expect(await store.get("thread:1")).not.toBeNull();
    await new Promise(r => setTimeout(r, 20));
    expect(await store.get("thread:1")).toBeNull();
  });
});

describe("TypedThreadState", () => {
  it("returns null initial state", async () => {
    const store = createThreadStateStore();
    const ts = createThreadState("thread:1", store);
    expect(await ts.state).toBeNull();
  });

  it("returns threadId", () => {
    const store = createThreadStateStore();
    const ts = createThreadState("thread:1", store);
    expect(ts.threadId).toBe("thread:1");
  });

  it("sets and gets state", async () => {
    const store = createThreadStateStore();
    const ts = createThreadState("thread:1", store);
    await ts.setState({ mode: "agent" });
    const state = await ts.state;
    expect(state).toEqual({ mode: "agent" });
  });

  it("merges state by default", async () => {
    const store = createThreadStateStore();
    const ts = createThreadState<{ a?: number; b?: number }>("thread:1", store);
    await ts.setState({ a: 1 });
    await ts.setState({ b: 2 });
    const state = await ts.state;
    expect(state).toEqual({ a: 1, b: 2 });
  });

  it("replaces state when replace is true", async () => {
    const store = createThreadStateStore();
    const ts = createThreadState<{ a?: number; b?: number }>("thread:1", store);
    await ts.setState({ a: 1 });
    await ts.setState({ b: 2 }, { replace: true });
    const state = await ts.state;
    expect(state).toEqual({ b: 2 });
  });

  it("supports optional TTL", async () => {
    interface MyState { x: number }
    const store = createThreadStateStore();
    const ts = createThreadState<MyState>("thread:1", store, 20);
    await ts.setState({ x: 1 });
    expect((await ts.state)?.x).toBe(1);
    await new Promise(r => setTimeout(r, 30));
    expect(await ts.state).toBeNull();
  });

  it("isolates state per threadId", async () => {
    const store = createThreadStateStore();
    const ts1 = createThreadState("thread:1", store);
    const ts2 = createThreadState("thread:2", store);
    await ts1.setState({ val: "a" });
    await ts2.setState({ val: "b" });
    expect((await ts1.state)?.val).toBe("a");
    expect((await ts2.state)?.val).toBe("b");
  });
});

describe("THREAD_STATE_TTL_MS", () => {
  it("is 30 days", () => {
    expect(THREAD_STATE_TTL_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });
});
