import { describe, expect, it, beforeEach } from "vitest";
import {
  InMemoryMemoryStore,
  FileMemoryStore,
  createMemoryTools,
  AUTO_MEMORY_SYSTEM_PROMPT,
  type AIMemoryEntry,
  type AIMemoryStore,
  type AIMemoryQuery,
} from "./memory";
import { DeterministicLanguageModel } from "./providers";
import { runAgentLoop, type AIToolContext } from "./agent-loop";
import { generate } from "./generation";

describe("AIMemoryEntry", () => {
  it("has required fields after save", async () => {
    const store = new InMemoryMemoryStore();
    const entry = await store.save({
      role: "assistant",
      content: "User likes cats",
    });
    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();
    expect(entry.updatedAt).toBeTruthy();
    expect(entry.content).toBe("User likes cats");
    expect(entry.role).toBe("assistant");
  });
});

describe("InMemoryMemoryStore", () => {
  let store: InMemoryMemoryStore;

  beforeEach(() => {
    store = new InMemoryMemoryStore();
  });

  it("saves and retrieves an entry", async () => {
    const entry = await store.save({ role: "assistant", content: "Hello" });
    const retrieved = await store.get(entry.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.content).toBe("Hello");
  });

  it("returns null for nonexistent id", async () => {
    expect(await store.get("nonexistent")).toBeNull();
  });

  it("deletes an entry", async () => {
    const entry = await store.save({ role: "assistant", content: "Delete me" });
    expect(await store.delete(entry.id)).toBe(true);
    expect(await store.get(entry.id)).toBeNull();
  });

  it("returns false when deleting nonexistent entry", async () => {
    expect(await store.delete("nonexistent")).toBe(false);
  });

  it("lists entries most-recent-first", async () => {
    await store.save({ role: "assistant", content: "First" });
    await sleep(5);
    await store.save({ role: "assistant", content: "Second" });
    const list = await store.list();
    expect(list).toHaveLength(2);
    expect(list[0].content).toBe("Second");
    expect(list[1].content).toBe("First");
  });

  it("lists with limit", async () => {
    await store.save({ role: "assistant", content: "A" });
    await store.save({ role: "assistant", content: "B" });
    await store.save({ role: "assistant", content: "C" });
    expect(await store.list({ limit: 2 })).toHaveLength(2);
  });

  it("searches by keyword", async () => {
    await store.save({ role: "assistant", content: "User likes pizza", tags: ["preference"] });
    await store.save({ role: "assistant", content: "User hates broccoli", tags: ["preference"] });
    const results = await store.search({ text: "pizza" });
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain("pizza");
  });

  it("searches by userId", async () => {
    await store.save({ role: "assistant", content: "Alice info", userId: "alice" });
    await store.save({ role: "assistant", content: "Bob info", userId: "bob" });
    const results = await store.search({ text: "info", userId: "alice" });
    expect(results).toHaveLength(1);
    expect(results[0].userId).toBe("alice");
  });

  it("searches by tags", async () => {
    await store.save({ role: "assistant", content: "Memory A", tags: ["important"] });
    await store.save({ role: "assistant", content: "Memory B", tags: ["trivial"] });
    const results = await store.search({ text: "Memory", tags: ["important"] });
    expect(results).toHaveLength(1);
    expect(results[0].content).toBe("Memory A");
  });

  it("clears all entries", async () => {
    await store.save({ role: "assistant", content: "A" });
    await store.save({ role: "assistant", content: "B" });
    await store.clear();
    expect(await store.list()).toHaveLength(0);
  });

  it("clears entries for a specific user", async () => {
    await store.save({ role: "assistant", content: "Alice", userId: "alice" });
    await store.save({ role: "assistant", content: "Bob", userId: "bob" });
    await store.clear("alice");
    expect(await store.list()).toHaveLength(1);
    expect((await store.list())[0].userId).toBe("bob");
  });
});

describe("FileMemoryStore", () => {
  it("writes and reads from a temp file", async () => {
    const tmpFile = `test_memory_${Date.now()}.json`;
    const store = new FileMemoryStore({ filePath: tmpFile, autoSave: true });
    const entry = await store.save({ role: "assistant", content: "Persistent memory" });
    expect(entry.id).toBeTruthy();
    const store2 = new FileMemoryStore({ filePath: tmpFile, autoSave: false });
    const loaded = await store2.get(entry.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.content).toBe("Persistent memory");
    try {
      const fs = require("fs");
      fs.unlinkSync(tmpFile);
    } catch { /* ignore cleanup */ }
  });

  it("handles empty file gracefully", async () => {
    const store = new FileMemoryStore({ filePath: "nonexistent_file_xyz.json", autoSave: false });
    expect(await store.list()).toHaveLength(0);
  });
});

describe("createMemoryTools", () => {
  let store: InMemoryMemoryStore;
  let tools: ReturnType<typeof createMemoryTools>;

  beforeEach(() => {
    store = new InMemoryMemoryStore();
    tools = createMemoryTools({ store });
  });

  it("creates remember tool", () => {
    expect(tools.remember).toBeDefined();
    expect(tools.remember.description).toBeTruthy();
    expect(tools.remember.inputSchema).toBeDefined();
  });

  it("creates recall tool", () => {
    expect(tools.recall).toBeDefined();
  });

  it("creates forget tool", () => {
    expect(tools.forget).toBeDefined();
  });

  it("creates listMemories tool", () => {
    expect(tools.listMemories).toBeDefined();
  });

  it("remember saves to the store and returns confirmation", async () => {
    const ctx = mockToolContext();
    const result = await tools.remember.execute({ content: "User loves TypeScript" }, ctx);
    expect(result).toContain("Remembered:");
    expect(result).toContain("User loves TypeScript");
    const entries = await store.list();
    expect(entries).toHaveLength(1);
    expect(entries[0].content).toBe("User loves TypeScript");
  });

  it("remember stores tags when provided", async () => {
    const ctx = mockToolContext();
    await tools.remember.execute({ content: "Favorite color is blue", tags: ["preference", "color"] }, ctx);
    const entries = await store.list();
    expect(entries[0].tags).toEqual(["preference", "color"]);
  });

  it("recall finds matching memories", async () => {
    await store.save({ role: "assistant", content: "User works at Acme Corp", tags: ["job"] });
    await store.save({ role: "assistant", content: "User lives in New York", tags: ["location"] });
    const ctx = mockToolContext();
    const result = await tools.recall.execute({ query: "Acme" }, ctx);
    expect(result).toContain("Acme Corp");
    expect(result).not.toContain("New York");
  });

  it("recall returns no-results message when nothing matches", async () => {
    const ctx = mockToolContext();
    const result = await tools.recall.execute({ query: "nonexistent" }, ctx);
    expect(result).toBe("No relevant memories found.");
  });

  it("forget deletes a memory", async () => {
    const entry = await store.save({ role: "assistant", content: "Temporary" });
    const ctx = mockToolContext();
    const result = await tools.forget.execute({ id: entry.id }, ctx);
    expect(result).toContain("deleted");
    expect(await store.get(entry.id)).toBeNull();
  });

  it("forget returns not-found for nonexistent id", async () => {
    const ctx = mockToolContext();
    const result = await tools.forget.execute({ id: "nonexistent" }, ctx);
    expect(result).toContain("not found");
  });

  it("listMemories returns stored memories", async () => {
    await store.save({ role: "assistant", content: "Memory A", tags: ["important"] });
    await store.save({ role: "assistant", content: "Memory B" });
    const ctx = mockToolContext();
    const result = await tools.listMemories.execute({}, ctx);
    expect(result).toContain("Memory A");
    expect(result).toContain("Memory B");
  });

  it("listMemories returns empty message when no memories", async () => {
    const ctx = mockToolContext();
    const result = await tools.listMemories.execute({}, ctx);
    expect(result).toBe("No memories stored yet.");
  });

  it("listMemories filters by tag", async () => {
    await store.save({ role: "assistant", content: "Important thing", tags: ["important"] });
    await store.save({ role: "assistant", content: "Trivial thing", tags: ["trivial"] });
    const ctx = mockToolContext();
    const result = await tools.listMemories.execute({ tag: "important" }, ctx);
    expect(result).toContain("Important thing");
    expect(result).not.toContain("Trivial thing");
  });

  it("recall uses userId from tool context", async () => {
    await store.save({ role: "assistant", content: "Alice data", userId: "alice" });
    await store.save({ role: "assistant", content: "Bob data", userId: "bob" });
    const ctx = mockToolContext({ userId: "alice" });
    const result = await tools.recall.execute({ query: "data" }, ctx);
    expect(result).toContain("Alice data");
    expect(result).not.toContain("Bob data");
  });

  it("remember uses userId from tool context", async () => {
    const ctx = mockToolContext({ userId: "alice" });
    await tools.remember.execute({ content: "Alice preference" }, ctx);
    const entries = await store.list();
    expect(entries[0].userId).toBe("alice");
  });
});

describe("memory tools with agent loop", () => {
  it("agent can use remember tool through agent loop", async () => {
    const store = new InMemoryMemoryStore();
    const tools = createMemoryTools({ store });

    let rememberCalled = false;
    const originalExecute = tools.remember.execute;
    tools.remember.execute = async (input, ctx) => {
      rememberCalled = true;
      return originalExecute.call(tools.remember, input, ctx);
    };

    const model = new DeterministicLanguageModel((request) => {
      const last = request.prompt[request.prompt.length - 1];
      return `I remember: ${last.content}`;
    });

    const result = await runAgentLoop({
      runStep: async () => {
        const gen = await generate({ model, prompt: [{ role: "user", content: "Hi" }] });
        return { text: gen.text, toolCalls: [], finishReason: "stop" };
      },
      maxSteps: 2,
      tools: { remember: tools.remember },
    });

    expect(result.text).toContain("I remember:");
  });
});

describe("AUTO_MEMORY_SYSTEM_PROMPT", () => {
  it("contains memory tool instructions", () => {
    expect(AUTO_MEMORY_SYSTEM_PROMPT).toContain("remember");
    expect(AUTO_MEMORY_SYSTEM_PROMPT).toContain("recall");
    expect(AUTO_MEMORY_SYSTEM_PROMPT).toContain("listMemories");
    expect(AUTO_MEMORY_SYSTEM_PROMPT).toContain("forget");
  });
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mockToolContext(tool?: Record<string, unknown>): AIToolContext<unknown> {
  return { signal: new AbortController().signal, step: 0, tool };
}
