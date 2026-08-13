import { describe, it, expect, beforeEach } from "vitest";
import { MockAdapter, createMockAdapter } from "./mock-adapter.js";

describe("NW-112 MockAdapter lifecycle", () => {
  /** @type {MockAdapter} */
  let adapter;

  beforeEach(() => {
    adapter = createMockAdapter();
  });

  it("disconnect() marks adapter offline and blocks sends", async () => {
    expect(typeof adapter.disconnect).toBe("function");
    await adapter.disconnect();
    expect(adapter.disconnected).toBe(true);
    expect(adapter.disconnectCount).toBe(1);
    await expect(adapter.postChannelMessage("ch-1", { text: "hi" })).rejects.toThrow(
      "mock_adapter_disconnected",
    );
  });

  it("postChannelMessage + fetchChannelMessages paginate", async () => {
    await adapter.postChannelMessage("ch-1", { text: "a" });
    await adapter.postChannelMessage("ch-1", { text: "b" });
    await adapter.postChannelMessage("ch-1", { text: "c" });

    const page1 = await adapter.fetchChannelMessages("ch-1", { limit: 2 });
    expect(page1.messages).toHaveLength(2);
    expect(page1.messages[0].text).toBe("a");
    expect(page1.hasMore).toBe(true);
    expect(page1.nextCursor).toBeTruthy();

    const page2 = await adapter.fetchChannelMessages("ch-1", {
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.messages).toHaveLength(1);
    expect(page2.messages[0].text).toBe("c");
    expect(page2.hasMore).toBe(false);
  });

  it("listThreads tracks replies as threads", async () => {
    const root = await adapter.postChannelMessage("ch-1", { text: "root" });
    await adapter.postChannelMessage("ch-1", { text: "reply", parentId: root.id });
    await adapter.postChannelMessage("ch-1", { text: "reply2", parentId: root.id });

    const listed = await adapter.listThreads("ch-1", { limit: 10 });
    expect(listed.threads).toHaveLength(1);
    expect(listed.threads[0].rootMessage.id).toBe(root.id);
    expect(listed.threads[0].replyCount).toBe(2);
  });

  it("createMockAdapter factory returns MockAdapter", () => {
    expect(createMockAdapter()).toBeInstanceOf(MockAdapter);
  });
});
