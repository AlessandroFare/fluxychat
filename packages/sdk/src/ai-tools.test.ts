import { describe, it, expect } from "vitest";
import {
  getPresetTools,
  needsApproval,
  getToolDefinition,
  listPresets,
  buildToolList,
  createChatTools,
  type ChatBinding,
  type ToolName,
} from "./ai-tools";

function createMockBinding(): ChatBinding {
  return {
    thread: () => ({
      post: async (content: string) => ({ id: "msg-1", content }),
      startTyping: async () => {},
      subscribe: async () => {},
      unsubscribe: async () => {},
      getParticipants: async () => [{ userId: "user-1", userName: "User 1" }],
      adapter: {
        fetchMessages: async () => ({ messages: [], hasMore: false }),
        editMessage: async () => {},
        deleteMessage: async () => {},
        addReaction: async () => {},
        removeReaction: async () => {},
      },
    }),
    channel: () => ({
      post: async (content: string) => ({ id: "msg-2", content }),
      fetchMetadata: async () => ({ id: "ch-1", name: "General", memberCount: 5, isDM: false }),
      adapter: {
        fetchChannelMessages: async () => ({ messages: [], hasMore: false }),
        listThreads: async () => ({ threads: [], hasMore: false }),
      },
    }),
    getAdapter: () => ({}),
    getUser: async (userId: string) => ({ userId, userName: "Test User", isBot: false }),
    openDM: async () => ({
      post: async (content: string) => ({ id: "dm-1", content }),
    }),
  };
}

describe("getPresetTools", () => {
  it("returns reader preset tools", () => {
    const tools = getPresetTools("reader");
    expect(tools).toContain("fetchMessages");
    expect(tools).toContain("getUser");
    expect(tools).not.toContain("postMessage");
  });

  it("returns messenger preset tools", () => {
    const tools = getPresetTools("messenger");
    expect(tools).toContain("postMessage");
    expect(tools).toContain("addReaction");
    expect(tools).not.toContain("deleteMessage");
  });

  it("returns moderator preset tools", () => {
    const tools = getPresetTools("moderator");
    expect(tools).toContain("deleteMessage");
    expect(tools).toContain("subscribeThread");
    expect(tools).toContain("startTyping");
  });
});

describe("needsApproval", () => {
  it("returns true for write tools", () => {
    expect(needsApproval("moderator", "postMessage")).toBe(true);
    expect(needsApproval("moderator", "deleteMessage")).toBe(true);
  });
  it("returns false for read tools", () => {
    expect(needsApproval("moderator", "fetchMessages")).toBe(false);
    expect(needsApproval("moderator", "getUser")).toBe(false);
  });
});

describe("getToolDefinition", () => {
  it("returns definition for known tools", () => {
    const def = getToolDefinition("fetchMessages");
    expect(def).toBeDefined();
    expect(def!.category).toBe("read");
    expect(def!.inputSchema).toBeDefined();
  });
  it("returns undefined for unknown tools", () => {
    expect(getToolDefinition("unknown")).toBeUndefined();
  });
});

describe("listPresets", () => {
  it("returns three presets with descriptions", () => {
    const presets = listPresets();
    expect(presets).toHaveLength(3);
    expect(presets[0].name).toBe("reader");
    expect(presets[0].toolCount).toBeGreaterThan(0);
  });
});

describe("buildToolList", () => {
  it("returns tool definitions with needsApproval flags", () => {
    const list = buildToolList("reader");
    expect(list.length).toBeGreaterThan(0);
    const fetchMsg = list.find((t) => t.name === "fetchMessages");
    expect(fetchMsg).toBeDefined();
    expect(fetchMsg!.needsApproval).toBe(false);
  });

  it("applies overrides", () => {
    const list = buildToolList("reader", {
      needsApproval: { fetchMessages: true },
      description: { fetchMessages: "Custom description" },
    });
    const fetchMsg = list.find((t) => t.name === "fetchMessages")!;
    expect(fetchMsg.needsApproval).toBe(true);
    expect(fetchMsg.description).toBe("Custom description");
  });
});

describe("createChatTools", () => {
  it("throws without chat", () => {
    expect(() =>
      (createChatTools as any)({})
    ).toThrow("requires a `chat` instance");
  });

  it("returns all tools when no preset specified", () => {
    const tools = createChatTools({ chat: createMockBinding() });
    expect(Object.keys(tools).length).toBeGreaterThan(0);
  });

  it("filters by preset", () => {
    const tools = createChatTools({ chat: createMockBinding(), preset: "reader" });
    expect(tools.fetchMessages).toBeDefined();
    expect(tools.postMessage).toBeUndefined();
  });

  it("sets needsApproval from requireApproval config", () => {
    const tools = createChatTools({
      chat: createMockBinding(),
      preset: "messenger",
      requireApproval: { postMessage: false },
    });
    expect(tools.postMessage?.needsApproval).toBe(false);
  });

  it("applies tool overrides", () => {
    const tools = createChatTools({
      chat: createMockBinding(),
      preset: "reader",
      overrides: { fetchMessages: { description: "Custom fetch" } },
    });
    expect(tools.fetchMessages?.description).toBe("Custom fetch");
  });

  it("creates executable tools", async () => {
    const tools = createChatTools({ chat: createMockBinding(), preset: "messenger" });
    const msgTool = tools.postMessage;
    expect(msgTool).toBeDefined();
    const result = await msgTool!.execute({ threadId: "test", message: "hello" });
    expect(result).toBeDefined();
    expect((result as any).content).toBe("hello");
  });

  it("preserves protected fields from overrides", () => {
    const tools = createChatTools({
      chat: createMockBinding(),
      preset: "messenger",
      overrides: { postMessage: { description: "New desc", enabled: false } as any },
    });
    expect(tools.postMessage?.description).toBe("New desc");
  });
});
