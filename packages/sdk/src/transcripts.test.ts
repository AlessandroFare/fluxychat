import { describe, it, expect } from "vitest";
import { createTranscriptsApi } from "./transcripts";
import type { TranscriptEntry } from "./transcripts";

const testMsg = (overrides?: Partial<{ content: string; id: string }>) => ({
  content: overrides?.content ?? "hello",
  id: overrides?.id ?? "msg-1",
});

describe("createTranscriptsApi", () => {
  it("appends a message and returns an entry", async () => {
    const api = createTranscriptsApi();
    const entry = await api.append("thread:1", "slack", testMsg(), { userKey: "user@example.com" });
    expect(entry).not.toBeNull();
    expect(entry!.userKey).toBe("user@example.com");
    expect(entry!.text).toBe("hello");
    expect(entry!.platform).toBe("slack");
    expect(entry!.threadId).toBe("thread:1");
    expect(entry!.role).toBe("user");
    expect(entry!.id).toBeDefined();
    expect(entry!.timestamp).toBeGreaterThan(0);
  });

  it("returns null when no userKey for message", async () => {
    const api = createTranscriptsApi();
    const entry = await api.append("thread:1", "slack", testMsg());
    expect(entry).toBeNull();
  });

  it("appends an AppendInput with explicit userKey", async () => {
    const api = createTranscriptsApi();
    const entry = await api.append("thread:1", "slack", { text: "AI reply", role: "assistant" }, { userKey: "user@example.com" });
    expect(entry).not.toBeNull();
    expect(entry!.role).toBe("assistant");
    expect(entry!.text).toBe("AI reply");
  });

  it("throws when AppendInput lacks userKey", async () => {
    const api = createTranscriptsApi();
    await expect(api.append("thread:1", "slack", { text: "reply", role: "assistant" })).rejects.toThrow("userKey");
  });

  it("preserves platformMessageId when present", async () => {
    const api = createTranscriptsApi();
    const entry = await api.append("thread:1", "slack", testMsg({ id: "msg-42" }), { userKey: "u1" });
    expect(entry!.platformMessageId).toBe("msg-42");
  });

  it("lists returns appended entries in order", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:1", "slack", { text: "first", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "slack", { text: "second", role: "assistant" }, { userKey: "u1" });

    const entries = await api.list({ userKey: "u1" });
    expect(entries).toHaveLength(2);
    expect(entries[0].text).toBe("first");
    expect(entries[1].text).toBe("second");
  });

  it("list respects limit", async () => {
    const api = createTranscriptsApi();
    for (let i = 0; i < 10; i++) {
      await api.append("thread:1", "slack", { text: `msg-${i}`, role: "user" }, { userKey: "u1" });
    }

    const entries = await api.list({ userKey: "u1", limit: 3 });
    expect(entries).toHaveLength(3);
    expect(entries[0].text).toBe("msg-7");
  });

  it("list filters by platform", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:1", "slack", { text: "slack msg", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "discord", { text: "discord msg", role: "user" }, { userKey: "u1" });

    const slackOnly = await api.list({ userKey: "u1", platforms: ["slack"] });
    expect(slackOnly).toHaveLength(1);
    expect(slackOnly[0].platform).toBe("slack");
  });

  it("list filters by threadId", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:a", "slack", { text: "in a", role: "user" }, { userKey: "u1" });
    await api.append("thread:b", "slack", { text: "in b", role: "user" }, { userKey: "u1" });

    const threadA = await api.list({ userKey: "u1", threadId: "thread:a" });
    expect(threadA).toHaveLength(1);
    expect(threadA[0].threadId).toBe("thread:a");
  });

  it("list filters by role", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:1", "slack", { text: "user msg", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "slack", { text: "ai msg", role: "assistant" }, { userKey: "u1" });

    const assistantOnly = await api.list({ userKey: "u1", roles: ["assistant"] });
    expect(assistantOnly).toHaveLength(1);
    expect(assistantOnly[0].role).toBe("assistant");
  });

  it("list returns empty for unknown userKey", async () => {
    const api = createTranscriptsApi();
    const entries = await api.list({ userKey: "nonexistent" });
    expect(entries).toEqual([]);
  });

  it("count returns total entries", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:1", "slack", { text: "a", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "slack", { text: "b", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "discord", { text: "c", role: "user" }, { userKey: "u1" });

    const count = await api.count({ userKey: "u1" });
    expect(count).toBe(3);
  });

  it("count returns 0 for unknown userKey", async () => {
    const api = createTranscriptsApi();
    expect(await api.count({ userKey: "nonexistent" })).toBe(0);
  });

  it("delete wipes all entries and returns count", async () => {
    const api = createTranscriptsApi();
    await api.append("thread:1", "slack", { text: "a", role: "user" }, { userKey: "u1" });
    await api.append("thread:1", "slack", { text: "b", role: "user" }, { userKey: "u1" });

    const result = await api.delete({ userKey: "u1" });
    expect(result.deleted).toBe(2);

    const entries = await api.list({ userKey: "u1" });
    expect(entries).toEqual([]);
  });

  it("delete on empty user returns 0", async () => {
    const api = createTranscriptsApi();
    const result = await api.delete({ userKey: "nonexistent" });
    expect(result.deleted).toBe(0);
  });

  it("respects maxPerUser config", async () => {
    const api = createTranscriptsApi({ maxPerUser: 3 });
    for (let i = 0; i < 5; i++) {
      await api.append("thread:1", "slack", { text: `msg-${i}`, role: "user" }, { userKey: "u1" });
    }

    const entries = await api.list({ userKey: "u1" });
    expect(entries).toHaveLength(3);
    expect(entries[0].text).toBe("msg-2");
    expect(entries[2].text).toBe("msg-4");
  });

  it("retention TTL expires old entries", async () => {
    const api = createTranscriptsApi({ retention: 1 }); // 1ms TTL
    await api.append("thread:1", "slack", { text: "ephemeral", role: "user" }, { userKey: "u1" });

    await new Promise((r) => setTimeout(r, 10));

    const entries = await api.list({ userKey: "u1" });
    expect(entries).toHaveLength(0);
  });

  it("handles concurrent appends for same user", async () => {
    const api = createTranscriptsApi();
    await Promise.all([
      api.append("thread:1", "slack", { text: "a", role: "user" }, { userKey: "u1" }),
      api.append("thread:1", "slack", { text: "b", role: "user" }, { userKey: "u1" }),
      api.append("thread:1", "slack", { text: "c", role: "user" }, { userKey: "u1" }),
    ]);

    const entries = await api.list({ userKey: "u1" });
    expect(entries).toHaveLength(3);
  });

  it("list returns newest entries when limited", async () => {
    const api = createTranscriptsApi();
    for (let i = 0; i < 5; i++) {
      const role: "user" | "assistant" = i % 2 === 0 ? "user" : "assistant";
      await api.append("thread:1", "slack", { text: `msg-${i}`, role }, { userKey: "u1" });
    }

    const entries = await api.list({ userKey: "u1", limit: 2, roles: ["user"] });
    expect(entries).toHaveLength(2);
  });
});
