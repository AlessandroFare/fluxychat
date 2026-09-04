/**
 * DX-5.1 — Testing utilities for adapters and FluxyChatClient mocks.
 *
 * Import from `@fluxy-chat/sdk/testing` in Vitest/Jest suites.
 */

import type { RawMessage, ThreadAdapter } from "./adapter-types";
import { createMockAdapter, MockAdapter } from "./mock-adapter";

export interface SpyAdapterCall {
  method: string;
  args: unknown[];
}

export interface SpyAdapter extends ThreadAdapter {
  readonly calls: SpyAdapterCall[];
  resetCalls(): void;
}

/** In-memory mock adapter with a call log for assertions. */
export function createSpyAdapter(base?: MockAdapter): SpyAdapter {
  const inner = base ?? createMockAdapter();
  const calls: SpyAdapterCall[] = [];

  function record(method: string, args: unknown[]) {
    calls.push({ method, args });
  }

  const proxy: SpyAdapter = {
    name: inner.name,
    displayName: inner.displayName,
    version: inner.version,
    format: inner.format,
    calls,
    resetCalls() {
      calls.length = 0;
    },
    async postMessage(threadId: string, content: string) {
      record("postMessage", [threadId, content]);
      return inner.postMessage(threadId, content);
    },
    async editMessage(threadId: string, messageId: string, content: string) {
      record("editMessage", [threadId, messageId, content]);
      return inner.editMessage(threadId, messageId, content);
    },
    async deleteMessage(threadId: string, messageId: string) {
      record("deleteMessage", [threadId, messageId]);
      return inner.deleteMessage(threadId, messageId);
    },
    async addReaction(threadId: string, messageId: string, emoji: string) {
      record("addReaction", [threadId, messageId, emoji]);
      return inner.addReaction(threadId, messageId, emoji);
    },
    async removeReaction(threadId: string, messageId: string, emoji: string) {
      record("removeReaction", [threadId, messageId, emoji]);
      return inner.removeReaction(threadId, messageId, emoji);
    },
    async startTyping(threadId: string) {
      record("startTyping", [threadId]);
      return inner.startTyping(threadId);
    },
    async fetchMessages(threadId: string, limit?: number) {
      record("fetchMessages", [threadId, limit]);
      return inner.fetchMessages(threadId, limit);
    },
    async fetchThread(threadId: string) {
      record("fetchThread", [threadId]);
      return inner.fetchThread(threadId);
    },
    async fetchChannelInfo(channelId: string) {
      record("fetchChannelInfo", [channelId]);
      return inner.fetchChannelInfo(channelId);
    },
    async getUser(userId: string) {
      record("getUser", [userId]);
      return inner.getUser(userId);
    },
  };

  return proxy;
}

export interface FluxyChatMockClientOptions {
  authenticated?: boolean;
  inbox?: import("./index").FluxyInboxSummary;
}

/** Minimal FluxyChatClient stub for hook and integration tests. */
export function createFluxyChatMockClient(
  options: FluxyChatMockClientOptions = {},
): import("./index").FluxyChatClient {
  const authenticated = options.authenticated ?? true;
  const inbox =
    options.inbox ??
    ({
      mentions: [],
      unreadRooms: [],
      snoozedRooms: [],
      followUps: [],
      counts: { mentions: 0, unreadRooms: 0, snoozedRooms: 0, followUps: 0 },
    } satisfies import("./index").FluxyInboxSummary);

  const markReadCalls: Array<{ roomId: string; messageId: number }> = [];

  const client = {
    isAuthenticated: () => authenticated,
    resolveToken: async () => undefined,
    getInbox: async () => inbox,
    markReadRest: async (roomId: string, messageId: number) => {
      markReadCalls.push({ roomId, messageId });
    },
    connectInbox: () =>
      ({
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {},
      }) as unknown as WebSocket,
    connectUser: () =>
      ({
        addEventListener: () => {},
        removeEventListener: () => {},
        close: () => {},
      }) as unknown as WebSocket,
    __markReadCalls: markReadCalls,
  };

  return client as unknown as import("./index").FluxyChatClient;
}

function findAdapterCalls(
  adapter: SpyAdapter,
  method: "postMessage" | "editMessage",
  threadId?: string,
) {
  return adapter.calls.filter(
    (call) =>
      call.method === method &&
      (threadId == null || call.args[0] === threadId),
  );
}

export interface FluxyChatTestingMatchers {
  toHavePosted(threadId: string, content?: string): void;
  toHaveEdited(threadId: string, messageId: string, content?: string): void;
}

/** Register Vitest/Jest custom matchers for spy adapters. */
export function registerFluxyChatMatchers(
  customExpect?: { extend: (matchers: object) => void },
): void {
  const expectApi =
    customExpect ??
    (globalThis as { expect?: { extend?: (matchers: object) => void } }).expect;
  if (!expectApi?.extend) return;

  expectApi.extend({
    toHavePosted(received: SpyAdapter, threadId: string, content?: string) {
      const posts = findAdapterCalls(received, "postMessage", threadId);
      const matched =
        content == null
          ? posts.length > 0
          : posts.some((call) => call.args[1] === content);
      return {
        pass: matched,
        message: () =>
          matched
            ? `expected adapter not to post to ${threadId}`
            : `expected adapter to post${content ? ` "${content}"` : ""} to ${threadId}`,
      };
    },
    toHaveEdited(
      received: SpyAdapter,
      threadId: string,
      messageId: string,
      content?: string,
    ) {
      const edits = findAdapterCalls(received, "editMessage", threadId).filter(
        (call) => call.args[1] === messageId,
      );
      const matched =
        content == null
          ? edits.length > 0
          : edits.some((call) => call.args[2] === content);
      return {
        pass: matched,
        message: () =>
          matched
            ? `expected adapter not to edit ${messageId} in ${threadId}`
            : `expected adapter to edit ${messageId} in ${threadId}${content ? ` with "${content}"` : ""}`,
      };
    },
  });
}

export type { RawMessage };
