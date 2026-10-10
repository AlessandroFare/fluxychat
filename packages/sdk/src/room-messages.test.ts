import { describe, expect, it } from "vitest";
import { bindRoomMessages } from "./room-messages";
import type { FluxyChatRoomConnection } from "./room-connection";
import type { FluxyChatEvent, FluxyChatMessage } from "./fluxy-chat-client";

describe("bindRoomMessages", () => {
  it("subscribe receives message events and historyBeforeSubscribe uses newestFirst", async () => {
    const seen: string[] = [];
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const connection = {
      sendMessageText(content: string, extras?: { metadata?: Record<string, unknown> }) {
        return Promise.resolve({ id: 1, content, metadata: extras?.metadata } as FluxyChatMessage);
      },
      fetchHistory() {
        return Promise.resolve([
          { id: 1, createdAt: "2026-01-01T00:00:00.000Z" },
          { id: 2, createdAt: "2026-01-02T00:00:00.000Z" },
        ] as FluxyChatMessage[]);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection;

    const messages = bindRoomMessages(connection);
    const sub = messages.subscribe((event) => seen.push(event.type));
    anyHandler?.({ type: "message", id: 3 } as FluxyChatEvent);
    anyHandler?.({
      type: "occupancy",
      roomId: "lobby",
      connections: 1,
      presenceMembers: 1,
    });
    anyHandler?.({ type: "edit", id: 3, roomId: "lobby", userId: "ada", content: "bye", editedAt: "2026-01-01T00:00:01.000Z" } as FluxyChatEvent);
    anyHandler?.({ type: "delete", id: 3, roomId: "lobby", userId: "ada", deletedAt: "2026-01-01T00:00:02.000Z" } as FluxyChatEvent);
    expect(seen).toEqual(["message.created", "message.updated", "message.deleted"]);
    const history = await sub.historyBeforeSubscribe({ limit: 2 });
    expect(history.items.map((row) => row.id)).toEqual([2, 1]);
    sub.unsubscribe();
  });

  it("FX-HIST-8 subscribe filters by message event type", () => {
    const seen: string[] = [];
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const connection = {
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection;
    const messages = bindRoomMessages(connection);
    const sub = messages.subscribe("message.updated", (event) => seen.push(event.type));
    anyHandler?.({ type: "message", id: 3 } as FluxyChatEvent);
    anyHandler?.({
      type: "edit",
      id: 3,
      roomId: "lobby",
      userId: "ada",
      content: "bye",
      editedAt: "2026-01-01T00:00:01.000Z",
    } as FluxyChatEvent);
    expect(seen).toEqual(["message.updated"]);
    expect(typeof sub.off).toBe("function");
    sub.off();
  });

  it("FX-HIST-2 get parses serial-like strings and checks the connection", async () => {
    const connection = {
      getMessageById(messageId: number) {
        return Promise.resolve({ id: messageId, content: "hello" } as FluxyChatMessage);
      },
      sendMessageText() {
        return Promise.resolve(null);
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection;
    const messages = bindRoomMessages(connection);
    const row = await messages.get(9);
    expect(row.id).toBe(9);
    expect(row.content).toBe("hello");
    expect(() => {
      void messages.get("nope");
    }).toThrow(/invalid id/);
  });

  it("FX-HIST-3 getVersions returns a single page oldest-first from REST", async () => {
    const connection = {
      getMessageVersions(messageId: number) {
        return Promise.resolve([
          { id: messageId, content: "a" },
          { id: messageId, content: "b" },
        ] as FluxyChatMessage[]);
      },
      sendMessageText() {
        return Promise.resolve(null);
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection;
    const page = await bindRoomMessages(connection).getVersions(9);
    expect(page.items.map((row) => row.content)).toEqual(["a", "b"]);
    expect(page.hasNext()).toBe(false);
  });

  it("update/delete/reactions call connection REST wrappers", async () => {
    const calls: unknown[][] = [];
    const connection = {
      sendMessageText(content: string, extras?: { metadata?: Record<string, unknown>; headers?: Record<string, string> }) {
        calls.push(["send", content, extras]);
        return Promise.resolve({ id: 1, content } as FluxyChatMessage);
      },
      editMessageText(
        messageId: number,
        content: string,
        extras?: {
          metadata?: Record<string, unknown>;
          headers?: Record<string, string>;
          description?: string;
          operationMetadata?: Record<string, unknown>;
        },
      ) {
        calls.push(["edit", messageId, content, extras]);
        return Promise.resolve({ id: messageId, content } as FluxyChatMessage);
      },
      deleteMessage(messageId: number, details?: { description?: string; metadata?: Record<string, unknown> }) {
        calls.push(["delete", messageId, details]);
        return Promise.resolve({ id: messageId, content: "[deleted]" } as FluxyChatMessage);
      },
      getClientReactions(messageId: number, userId?: string) {
        calls.push(["clientReactions", messageId, userId]);
        return Promise.resolve({
          userId: userId ?? "u",
          names: ["👍"],
          unique: {},
          distinct: {},
          multiple: {},
        });
      },
      getReactionSummary(messageId: number) {
        calls.push(["summary", messageId]);
        return Promise.resolve({
          messageId,
          unique: { "👍": { total: 1, clientIds: ["ada"] } },
          distinct: { "👍": { total: 1, clientIds: ["ada"] } },
          multiple: {},
        });
      },
      sendMessageReaction(
        messageId: number,
        name: string,
        op: "add" | "remove",
        extras?: { type?: string; count?: number },
      ) {
        calls.push(["reaction", messageId, name, op, extras]);
        return Promise.resolve();
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection;

    const messages = bindRoomMessages(connection);
    await messages.update(9, "edited");
    await messages.update(9, { text: "edited", metadata: { edited: true }, headers: { source: "cli" } });
    await messages.update(9, "edited", { description: "typo", metadata: { src: "cli" } });
    await messages.delete(9);
    await messages.delete(9, { description: "spam" });
    await messages.reactions.send(9, "👍");
    await messages.reactions.delete(9, "👍");
    await messages.reactions.clientReactions(9, "ada");
    await messages.reactions.get(9);
    await messages.send({
      text: "hi",
      metadata: { color: "red" },
      headers: { source: "cli" },
      replyTo: 8,
    });
    expect(calls).toEqual([
      ["edit", 9, "edited", undefined],
      ["edit", 9, "edited", { metadata: { edited: true }, headers: { source: "cli" } }],
      ["edit", 9, "edited", { description: "typo", operationMetadata: { src: "cli" } }],
      ["delete", 9, undefined],
      ["delete", 9, { description: "spam" }],
      ["reaction", 9, "👍", "add", { type: "distinct" }],
      ["reaction", 9, "👍", "remove", { type: "distinct" }],
      ["clientReactions", 9, "ada"],
      ["summary", 9],
      ["send", "hi", { metadata: { color: "red" }, headers: { source: "cli" }, replyTo: 8 }],
    ]);
  });

  it("FX-REAC-4 send/delete pass type and count", async () => {
    const calls: unknown[][] = [];
    const connection = {
      defaultMessageReactionType: "distinct",
      sendMessageReaction(
        messageId: number,
        name: string,
        op: "add" | "remove",
        extras?: { type?: string; count?: number },
      ) {
        calls.push([messageId, name, op, extras]);
        return Promise.resolve();
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection;
    const messages = bindRoomMessages(connection);
    await messages.reactions.send(9, { name: "👏", type: "multiple", count: 3 });
    await messages.reactions.delete(9, { type: "unique" });
    expect(() => messages.reactions.delete(9, { type: "distinct" })).toThrow(/name required/);
    expect(calls).toEqual([
      [9, "👏", "add", { type: "multiple", count: 3 }],
      [9, "", "remove", { type: "unique" }],
    ]);
  });

  it("reactions.subscribeRaw receives live reaction frames", () => {
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const connection = {
      rawMessageReactionsEnabled: true,
      sendMessageText() {
        return Promise.resolve(null);
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection;
    const seen: string[] = [];
    const stop = bindRoomMessages(connection).reactions.subscribeRaw((event) => {
      seen.push(`${event.type}:${event.reaction.name}`);
    });
    anyHandler?.({
      type: "reaction",
      roomId: "lobby",
      userId: "ada",
      messageId: 9,
      emoji: "👍",
      op: "add",
    });
    anyHandler?.({ type: "message", id: 3 } as FluxyChatEvent);
    expect(seen).toEqual(["reaction.create:👍"]);
    stop();
  });

  it("subscribeRaw throws when raw reactions are disabled", () => {
    const messages = bindRoomMessages({
      rawMessageReactionsEnabled: false,
      sendMessageText() {
        return Promise.resolve(null);
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent() {},
      offAnyEvent() {},
    } as unknown as FluxyChatRoomConnection);
    expect(() => messages.reactions.subscribeRaw(() => {})).toThrow(/raw message reactions are disabled/);
  });

  it("FX-REAC-1 reactions.subscribe folds unique tallies", () => {
    let anyHandler: ((event: FluxyChatEvent) => void) | null = null;
    const connection = {
      sendMessageText() {
        return Promise.resolve(null);
      },
      fetchHistory() {
        return Promise.resolve([]);
      },
      onAnyEvent(handler: (event: FluxyChatEvent) => void) {
        anyHandler = handler;
      },
      offAnyEvent() {
        anyHandler = null;
      },
    } as unknown as FluxyChatRoomConnection;
    const seen: Array<{ total: number; ids: string[] }> = [];
    const stop = bindRoomMessages(connection).reactions.subscribe((event) => {
      seen.push({
        total: event.reactions.unique["👍"]?.total ?? 0,
        ids: event.reactions.unique["👍"]?.clientIds ?? [],
      });
    });
    anyHandler?.({
      type: "reaction",
      roomId: "lobby",
      userId: "ada",
      messageId: 9,
      emoji: "👍",
      op: "add",
    });
    anyHandler?.({
      type: "reaction",
      roomId: "lobby",
      userId: "lin",
      messageId: 9,
      emoji: "👍",
      op: "add",
    });
    expect(seen).toEqual([
      { total: 1, ids: ["ada"] },
      { total: 2, ids: ["ada", "lin"] },
    ]);
    stop();
  });
});
