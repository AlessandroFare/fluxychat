import { describe, it, expect, vi } from "vitest";
import {
  createSpyAdapter,
  createSpyState,
  createSpyChatInstance,
  createTestMessage,
  mockLogger,
  createMockLogger,
  matchers,
} from "./testing-utils";

describe("testing-utils", () => {
  describe("createSpyAdapter", () => {
    it("creates adapter with mock methods", () => {
      const a = createSpyAdapter();
      expect(a.name).toBe("mock");
      expect(typeof a.postMessage).toBe("function");
      expect(typeof a.editMessage).toBe("function");
      expect(typeof a.deleteMessage).toBe("function");
    });

    it("accepts overrides", () => {
      const a = createSpyAdapter("slack", { name: "slack-custom" });
      expect(a.name).toBe("slack-custom");
    });

    it("postMessage records calls in .mock.calls", () => {
      const a = createSpyAdapter();
      a.postMessage("tid", "hello");
      expect(a.postMessage.mock.calls).toHaveLength(1);
    });
  });

  describe("createSpyState", () => {
    it("creates state with in-memory maps", () => {
      const s = createSpyState();
      expect(s.cache instanceof Map).toBe(true);
      expect(s.subscriptions instanceof Map).toBe(true);
    });

    it("subscribe and unsubscribe affect cache", async () => {
      const s = createSpyState();
      await s.subscribe("thread-1");
      expect(await s.isSubscribed("thread-1")).toBe(true);
      await s.unsubscribe("thread-1");
      expect(await s.isSubscribed("thread-1")).toBe(false);
    });

    it("get/set/del work as key-value store", async () => {
      const s = createSpyState();
      await s.set("key1", { value: 42 });
      expect(await s.get("key1")).toEqual({ value: 42 });
      await s.del("key1");
      expect(await s.get("key1")).toBeUndefined();
    });

    it("acquireLock returns true by default", async () => {
      const s = createSpyState();
      await expect(s.acquireLock("test")).resolves.toBe(true);
    });
  });

  describe("createSpyChatInstance", () => {
    it("creates chat with mock handlers", () => {
      const c = createSpyChatInstance();
      expect(typeof c.processMessage).toBe("function");
    });

    it("getUserName returns default", async () => {
      const c = createSpyChatInstance();
      await expect(c.getUserName()).resolves.toBe("test-user");
    });
  });

  describe("createTestMessage", () => {
    it("creates message with required fields", () => {
      const m = createTestMessage("msg-1", "Hello world");
      expect(m.id).toBe("msg-1");
      expect(m.text).toBe("Hello world");
      expect(m.sender.id).toBe("sender-1");
    });

    it("merges overrides", () => {
      const m = createTestMessage("msg-2", "Hi", { threadId: "custom-thread" });
      expect(m.threadId).toBe("custom-thread");
    });
  });

  describe("mockLogger / createMockLogger", () => {
    it("mockLogger has info/warn/error/debug", () => {
      expect(typeof mockLogger.info).toBe("function");
      expect(typeof mockLogger.warn).toBe("function");
      expect(typeof mockLogger.error).toBe("function");
      expect(typeof mockLogger.debug).toBe("function");
    });

    it("createMockLogger returns fresh instance", () => {
      const l1 = createMockLogger();
      const l2 = createMockLogger();
      expect(l1.info).not.toBe(l2.info);
    });
  });

  describe("matchers", () => {
    it("toHavePosted passes when postMessage called with threadId", () => {
      const a = createSpyAdapter();
      a.postMessage("tid1", "hello");
      const result = matchers.toHavePosted(a, "tid1");
      expect(result.pass).toBe(true);
    });

    it("toHavePosted fails when threadId not called", () => {
      const a = createSpyAdapter();
      a.postMessage("tid2", "hello");
      const result = matchers.toHavePosted(a, "tid1");
      expect(result.pass).toBe(false);
    });

    it("toHavePosted matches text pattern", () => {
      const a = createSpyAdapter();
      a.postMessage("tid1", "Hello world");
      expect(matchers.toHavePosted(a, "tid1", /Hello/).pass).toBe(true);
      expect(matchers.toHavePosted(a, "tid1", /Goodbye/).pass).toBe(false);
    });

    it("toHaveEdited matches threadId, messageId and text", () => {
      const a = createSpyAdapter();
      a.editMessage("tid1", "mid1", "edited text");
      expect(matchers.toHaveEdited(a, "tid1", "mid1").pass).toBe(true);
      expect(matchers.toHaveEdited(a, "tid1", "mid1", /edited/).pass).toBe(true);
      expect(matchers.toHaveEdited(a, "tid1", "mid2").pass).toBe(false);
    });

    it("toHaveDeleted checks deleteMessage calls", () => {
      const a = createSpyAdapter();
      a.deleteMessage("tid1", "mid1");
      expect(matchers.toHaveDeleted(a, "tid1", "mid1").pass).toBe(true);
      expect(matchers.toHaveDeleted(a, "tid1", "mid2").pass).toBe(false);
    });

    it("toHaveReactedWith checks addReaction calls", () => {
      const a = createSpyAdapter();
      a.addReaction("tid1", "mid1", "👍");
      expect(matchers.toHaveReactedWith(a, "tid1", "mid1", "👍").pass).toBe(true);
      expect(matchers.toHaveReactedWith(a, "tid1", "mid1", "❤️").pass).toBe(false);
    });

    it("toHaveStartedTyping checks startTyping calls", () => {
      const a = createSpyAdapter();
      a.startTyping("tid1");
      expect(matchers.toHaveStartedTyping(a, "tid1").pass).toBe(true);
      expect(matchers.toHaveStartedTyping(a, "tid2").pass).toBe(false);
    });

    it("toHavePostedToChannel checks channel messages", () => {
      const a = createSpyAdapter();
      a.postChannelMessage("cid1", "channel msg");
      expect(matchers.toHavePostedToChannel(a, "cid1").pass).toBe(true);
      expect(matchers.toHavePostedToChannel(a, "cid1", /channel/).pass).toBe(true);
    });

    it("toHaveDispatched checks dispatch calls", () => {
      const c = createSpyChatInstance();
      c.dispatch("processMessage", {});
      expect(matchers.toHaveDispatched(c, "processMessage").pass).toBe(true);
      expect(matchers.toHaveDispatched(c, "processEdit").pass).toBe(false);
    });

    it("toBeSubscribedTo checks async subscription", async () => {
      const s = createSpyState();
      await s.subscribe("tid1");
      await expect(matchers.toBeSubscribedTo(s, "tid1")).resolves.toMatchObject({ pass: true });
      await expect(matchers.toBeSubscribedTo(s, "tid2")).resolves.toMatchObject({ pass: false });
    });
  });
});
