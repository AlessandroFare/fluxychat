/**
 * Tests for P26 features: chat-api, postable-object, errors, reviver
 */
import { describe, it, expect } from "vitest";
import {
  parseAdapterSlug,
  inferAdapterFromId,
  inferAdapterFromUserId,
  createChatApi,
  chat,
  ThreadRef,
  ChatApiError,
} from "./chat-api.js";
import {
  POSTABLE_OBJECT,
  isPostableObject,
  postPostableObject,
  withPostable,
} from "./postable-object.js";
import {
  AdapterError,
  AdapterRateLimitError,
  AuthenticationError,
  ResourceNotFoundError,
  PermissionError,
  ValidationError,
  NetworkError,
  AdapterNotFoundError,
  ThreadNotFoundError,
  MessageNotFoundError,
} from "./errors.js";
import { reviver, parseChatJSON } from "./reviver.js";
import { Card } from "./cards.js";
import { createPlan } from "./plan.js";

// =========================================================================
// chat-api.js
// =========================================================================

describe("chat-api", () => {
  describe("parseAdapterSlug", () => {
    it("extracts adapter slug from thread ID", () => {
      expect(parseAdapterSlug("slack:C123:msg456")).toBe("slack");
      expect(parseAdapterSlug("web:room-1:msg-1")).toBe("web");
      expect(parseAdapterSlug("discord:channel:msg")).toBe("discord");
    });

    it("returns null for invalid IDs", () => {
      expect(parseAdapterSlug("invalid")).toBe(null);
      expect(parseAdapterSlug("")).toBe(null);
      expect(parseAdapterSlug(null)).toBe(null);
      expect(parseAdapterSlug(":noPrefix")).toBe(null);
    });
  });

  describe("inferAdapterFromId", () => {
    it("returns catalog info for known adapters", () => {
      const info = inferAdapterFromId("slack:C123:msg456");
      expect(info).toBeTruthy();
      expect(info.slug).toBe("slack");
    });

    it("returns null for unknown adapter", () => {
      expect(inferAdapterFromId("unknown:abc:def")).toBe(null);
    });
  });

  describe("inferAdapterFromUserId", () => {
    it("detects Slack user IDs", () => {
      expect(inferAdapterFromUserId("U00FAKEUSER1")).toBe("slack");
      expect(inferAdapterFromUserId("W012A3BCD")).toBe("slack");
    });

    it("detects Teams user IDs", () => {
      expect(inferAdapterFromUserId("29:198PbJuw")).toBe("teams");
    });

    it("detects Google Chat user IDs", () => {
      expect(inferAdapterFromUserId("users/100000000000000000001")).toBe("gchat");
    });

    it("detects Discord snowflake IDs", () => {
      expect(inferAdapterFromUserId("1033044521375764530")).toBe("discord");
    });

    it("detects web UUIDs", () => {
      expect(inferAdapterFromUserId("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe("web");
    });

    it("returns null for unknown format", () => {
      expect(inferAdapterFromUserId("unknown_id_format")).toBe(null);
    });
  });

  describe("chat.thread()", () => {
    it("returns a ThreadRef for valid thread ID", () => {
      const thread = chat.thread("web:room-1:msg-1");
      expect(thread).toBeInstanceOf(ThreadRef);
      expect(thread.id).toBe("web:room-1:msg-1");
      expect(thread.adapterSlug).toBe("web");
    });

    it("throws for invalid thread ID", () => {
      expect(() => chat.thread("invalid")).toThrow(ChatApiError);
      expect(() => chat.thread("invalid")).toThrow(/Invalid thread ID/);
    });

    it("throws for unknown adapter", () => {
      expect(() => chat.thread("unknown:abc:def")).toThrow(ChatApiError);
      expect(() => chat.thread("unknown:abc:def")).toThrow(/Adapter.*not found/);
    });
  });

  describe("chat.openDM()", () => {
    it("returns a ThreadRef for Slack user", async () => {
      const thread = await chat.openDM("U00FAKEUSER1");
      expect(thread).toBeInstanceOf(ThreadRef);
      expect(thread.adapterSlug).toBe("slack");
      expect(thread.id).toContain("dm");
    });

    it("throws for unknown user ID format", async () => {
      await expect(chat.openDM("unknown_format")).rejects.toThrow(ChatApiError);
    });
  });

  describe("chat.getUser()", () => {
    it("returns minimal info for Slack user", async () => {
      const user = await chat.getUser("U00FAKEUSER1");
      expect(user.userId).toBe("U00FAKEUSER1");
      expect(user.adapter).toBe("slack");
    });
  });

  describe("createChatApi with context", () => {
    it("thread() returns ThreadRef with context", () => {
      const api = createChatApi({ db: {} });
      const thread = api.thread("web:room-1:msg-1");
      expect(thread).toBeInstanceOf(ThreadRef);
      expect(thread.adapterSlug).toBe("web");
    });

    it("getUser() queries D1 for web adapter", async () => {
      const mockDb = {
        prepare: () => ({
          bind: () => ({
            first: async () => ({
              id: "user-1",
              email: "test@test.com",
              name: "Test User",
              avatar_url: null,
            }),
          }),
        }),
      };
      const api = createChatApi({ db: mockDb });
      const user = await api.getUser("a1b2c3d4-e5f6-7890-abcd-ef1234567890");
      expect(user.userId).toBe("user-1");
      expect(user.email).toBe("test@test.com");
      expect(user.fullName).toBe("Test User");
    });
  });

  describe("ThreadRef", () => {
    it("serializes to JSON", () => {
      const thread = new ThreadRef({
        id: "web:room-1:msg-1",
        adapterSlug: "web",
        channelId: "room-1",
      });
      const json = thread.toJSON();
      expect(json._type).toBe("fluxy:Thread");
      expect(json.id).toBe("web:room-1:msg-1");
      expect(json.adapterSlug).toBe("web");
    });

    it("deserializes from JSON", () => {
      const data = {
        _type: "fluxy:Thread",
        id: "web:room-1:msg-1",
        adapterSlug: "web",
        channelId: "room-1",
      };
      const thread = ThreadRef.fromJSON(data);
      expect(thread).toBeInstanceOf(ThreadRef);
      expect(thread.id).toBe("web:room-1:msg-1");
    });
  });
});

// =========================================================================
// postable-object.js
// =========================================================================

describe("postable-object", () => {
  it("POSTABLE_OBJECT is a symbol", () => {
    expect(typeof POSTABLE_OBJECT).toBe("symbol");
  });

  it("isPostableObject detects postable objects", () => {
    const card = Card({ title: "Test", children: [] });
    expect(isPostableObject(card)).toBe(true);
  });

  it("isPostableObject rejects non-postable values", () => {
    expect(isPostableObject(null)).toBe(false);
    expect(isPostableObject(undefined)).toBe(false);
    expect(isPostableObject("string")).toBe(false);
    expect(isPostableObject({})).toBe(false);
    expect(isPostableObject({ $$typeof: "wrong" })).toBe(false);
  });

  it("Card implements PostableObject interface", () => {
    const card = Card({ title: "Test", children: [] });
    expect(card.$$typeof).toBe(POSTABLE_OBJECT);
    expect(card.kind).toBe("card");
    expect(typeof card.getFallbackText).toBe("function");
    expect(typeof card.getPostData).toBe("function");
    expect(typeof card.isSupported).toBe("function");
    expect(typeof card.onPosted).toBe("function");
  });

  it("Plan implements PostableObject interface", () => {
    const plan = createPlan("Test Plan");
    expect(plan.$$typeof).toBe(POSTABLE_OBJECT);
    expect(plan.kind).toBe("plan");
    expect(typeof plan.getFallbackText).toBe("function");
    expect(typeof plan.getPostData).toBe("function");
    expect(typeof plan.isSupported).toBe("function");
    expect(typeof plan.onPosted).toBe("function");
  });

  it("Card.getFallbackText() returns text", () => {
    const card = Card({
      title: "My Card",
      children: [{ type: "text", content: "Hello" }],
    });
    const text = card.getFallbackText();
    expect(text).toContain("My Card");
    expect(text).toContain("Hello");
  });

  it("Card.getPostData() returns card data", () => {
    const card = Card({ title: "T", children: [] });
    const data = card.getPostData();
    expect(data.type).toBe("card");
    expect(data.title).toBe("T");
  });

  it("Card.onPosted() stores messageId", () => {
    const card = Card({ title: "T", children: [] });
    card.onPosted({ messageId: "msg-1", threadId: "thread-1" });
    expect(card.messageId).toBe("msg-1");
    expect(card.threadId).toBe("thread-1");
  });

  it("postPostableObject uses fallback when not supported", async () => {
    const obj = {
      $$typeof: POSTABLE_OBJECT,
      kind: "custom",
      isSupported: () => false,
      getFallbackText: () => "Fallback text",
      getPostData: () => ({}),
      onPosted: () => {},
    };
    let postedText = null;
    await postPostableObject(
      obj,
      null,
      "thread-1",
      async (threadId, text) => {
        postedText = text;
        return { id: "msg-1", threadId };
      }
    );
    expect(postedText).toBe("Fallback text");
  });

  it("withPostable mixin adds interface methods", () => {
    class MyObject extends withPostable(class {}) {
      kind = "custom";
      getFallbackText() { return "custom"; }
      getPostData() { return {}; }
    }
    const obj = new MyObject();
    expect(obj.$$typeof).toBe(POSTABLE_OBJECT);
    expect(obj.isSupported({})).toBe(true);
    expect(typeof obj.onPosted).toBe("function");
  });
});

// =========================================================================
// errors.js
// =========================================================================

describe("errors", () => {
  it("AdapterError has adapter and code", () => {
    const err = new AdapterError("test error", "slack", "TEST_CODE");
    expect(err.adapter).toBe("slack");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test error");
    expect(err.name).toBe("AdapterError");
  });

  it("AdapterRateLimitError has retryAfter", () => {
    const err = new AdapterRateLimitError("slack", 30);
    expect(err.retryAfter).toBe(30);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.message).toContain("retry after 30s");
    expect(err).toBeInstanceOf(AdapterError);
  });

  it("AuthenticationError has default message", () => {
    const err = new AuthenticationError("teams");
    expect(err.message).toContain("Authentication failed");
    expect(err.code).toBe("AUTH_FAILED");
  });

  it("ResourceNotFoundError has resourceType and resourceId", () => {
    const err = new ResourceNotFoundError("slack", "channel", "C123");
    expect(err.resourceType).toBe("channel");
    expect(err.resourceId).toBe("C123");
    expect(err.message).toContain("channel 'C123'");
  });

  it("PermissionError has action and requiredScope", () => {
    const err = new PermissionError("teams", "send messages", "channels:write");
    expect(err.action).toBe("send messages");
    expect(err.requiredScope).toBe("channels:write");
    expect(err.message).toContain("channels:write");
  });

  it("ValidationError has message", () => {
    const err = new ValidationError("slack", "Too long");
    expect(err.message).toBe("Too long");
    expect(err.code).toBe("VALIDATION_ERROR");
  });

  it("NetworkError has originalError", () => {
    const original = new Error("timeout");
    const err = new NetworkError("gchat", "Connection timeout", original);
    expect(err.originalError).toBe(original);
    expect(err.code).toBe("NETWORK_ERROR");
  });

  it("AdapterNotFoundError", () => {
    const err = new AdapterNotFoundError("foo");
    expect(err.adapter).toBe("foo");
    expect(err.code).toBe("ADAPTER_NOT_FOUND");
    expect(err.message).toContain("not found");
  });

  it("ThreadNotFoundError has threadId", () => {
    const err = new ThreadNotFoundError("slack", "thread-123");
    expect(err.threadId).toBe("thread-123");
    expect(err.code).toBe("THREAD_NOT_FOUND");
  });

  it("MessageNotFoundError has messageId", () => {
    const err = new MessageNotFoundError("slack", "msg-456");
    expect(err.messageId).toBe("msg-456");
    expect(err.code).toBe("MESSAGE_NOT_FOUND");
  });

  it("all errors extend AdapterError", () => {
    expect(new AdapterRateLimitError("a")).toBeInstanceOf(AdapterError);
    expect(new AuthenticationError("a")).toBeInstanceOf(AdapterError);
    expect(new ResourceNotFoundError("a", "t")).toBeInstanceOf(AdapterError);
    expect(new PermissionError("a", "act")).toBeInstanceOf(AdapterError);
    expect(new ValidationError("a", "m")).toBeInstanceOf(AdapterError);
    expect(new NetworkError("a")).toBeInstanceOf(AdapterError);
    expect(new AdapterNotFoundError("a")).toBeInstanceOf(AdapterError);
    expect(new ThreadNotFoundError("a", "t")).toBeInstanceOf(AdapterError);
    expect(new MessageNotFoundError("a", "m")).toBeInstanceOf(AdapterError);
  });
});

// =========================================================================
// reviver.js
// =========================================================================

describe("reviver", () => {
  it("revives fluxy:Thread objects", () => {
    const json = JSON.stringify({
      thread: {
        _type: "fluxy:Thread",
        id: "web:room-1:msg-1",
        adapterSlug: "web",
        channelId: "room-1",
      },
    });
    const data = parseChatJSON(json);
    expect(data.thread).toBeInstanceOf(ThreadRef);
    expect(data.thread.id).toBe("web:room-1:msg-1");
  });

  it("revives fluxy:Message objects", () => {
    const json = JSON.stringify({
      msg: {
        _type: "fluxy:Message",
        id: "msg-1",
        text: "Hello",
        metadata: {
          dateSent: "2026-07-01T12:00:00.000Z",
          edited: false,
        },
        attachments: [],
        links: [],
      },
    });
    const data = parseChatJSON(json);
    expect(data.msg._type).toBe("fluxy:Message");
    expect(data.msg.metadata.dateSent).toBeInstanceOf(Date);
    expect(data.msg.attachments).toEqual([]);
    expect(data.msg.links).toEqual([]);
  });

  it("revives fluxy:Card objects", () => {
    const json = JSON.stringify({
      card: {
        _type: "fluxy:Card",
        type: "card",
        title: "Test Card",
        children: [],
      },
    });
    const data = parseChatJSON(json);
    expect(data.card._type).toBe("fluxy:Card");
    expect(data.card.title).toBe("Test Card");
  });

  it("reviver restores Date fields for regular objects", () => {
    const json = JSON.stringify({
      createdAt: "2026-07-01T12:00:00.000Z",
      updatedAt: "2026-07-01T13:00:00.000Z",
      name: "test",
    });
    const data = parseChatJSON(json);
    expect(data.createdAt).toBeInstanceOf(Date);
    expect(data.updatedAt).toBeInstanceOf(Date);
    expect(data.name).toBe("test");
  });

  it("parseChatJSON handles arrays", () => {
    const json = JSON.stringify([
      { _type: "fluxy:Thread", id: "a:b:c", adapterSlug: "a" },
      { _type: "fluxy:Thread", id: "d:e:f", adapterSlug: "d" },
    ]);
    const data = parseChatJSON(json);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toBeInstanceOf(ThreadRef);
    expect(data[1]).toBeInstanceOf(ThreadRef);
  });

  it("reviver leaves unknown _type as-is", () => {
    const json = JSON.stringify({ obj: { _type: "unknown:type", foo: "bar" } });
    const data = parseChatJSON(json);
    expect(data.obj._type).toBe("unknown:type");
    expect(data.obj.foo).toBe("bar");
  });

  it("reviver works with JSON.parse directly", () => {
    const json = JSON.stringify({
      thread: {
        _type: "fluxy:Thread",
        id: "web:room-1:msg-1",
        adapterSlug: "web",
        channelId: "room-1",
      },
    });
    const data = JSON.parse(json, reviver);
    expect(data.thread).toBeInstanceOf(ThreadRef);
  });
});
