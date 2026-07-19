import type { Message } from "./message";

type MockFn = {
  (...args: unknown[]): unknown;
  mock: { calls: unknown[][]; results: unknown[] };
};

function createMockFn(impl?: (...args: unknown[]) => unknown): MockFn {
  const calls: unknown[][] = [];
  const results: unknown[] = [];
  const fn = (...args: unknown[]) => {
    calls.push(args);
    try {
      const result = impl?.(...args);
      results.push(result);
      return result;
    } catch (e) {
      results.push(e);
      throw e;
    }
  };
  fn.mock = { calls, results };
  return fn;
}

function mockResolvedValue(val: unknown) {
  return createMockFn(() => Promise.resolve(val));
}

function mockReturnValue(val: unknown) {
  return createMockFn(() => val);
}

export interface SpyAdapter {
  name: string;
  postMessage: MockFn;
  editMessage: MockFn;
  deleteMessage: MockFn;
  addReaction: MockFn;
  startTyping: MockFn;
  postChannelMessage: MockFn;
  getState: MockFn;
  [key: string]: unknown;
}

export function createSpyAdapter(name = "mock", overrides?: Partial<SpyAdapter>): SpyAdapter {
  return {
    name,
    postMessage: createMockFn(),
    editMessage: createMockFn(),
    deleteMessage: createMockFn(),
    addReaction: createMockFn(),
    startTyping: createMockFn(),
    postChannelMessage: createMockFn(),
    getState: mockReturnValue({}),
    ...overrides,
  };
}

export type AdapterSpy = Record<string, MockFn>;

export interface SpyStateAdapter {
  subscriptions: Map<string, boolean>;
  locks: Map<string, string>;
  cache: Map<string, unknown>;
  isSubscribed: MockFn;
  subscribe: MockFn;
  unsubscribe: MockFn;
  acquireLock: MockFn;
  releaseLock: MockFn;
  get: MockFn;
  set: MockFn;
  del: MockFn;
}

export function createSpyState(): SpyStateAdapter {
  const cache = new Map<string, unknown>();
  return {
    subscriptions: new Map(),
    locks: new Map(),
    cache,
    isSubscribed: createMockFn(async (id: string) => cache.get(id) === true),
    subscribe: createMockFn(async (id: string) => { cache.set(id, true); }),
    unsubscribe: createMockFn(async (id: string) => { cache.delete(id); }),
    acquireLock: mockResolvedValue(true),
    releaseLock: mockResolvedValue(undefined),
    get: createMockFn(async (key: string) => cache.get(key)),
    set: createMockFn(async (key: string, val: unknown) => { cache.set(key, val); }),
    del: createMockFn(async (key: string) => { cache.delete(key); }),
  };
}

export interface SpyChatInstance {
  processMessage: MockFn;
  processEdit: MockFn;
  processDelete: MockFn;
  processReaction: MockFn;
  processTyping: MockFn;
  getState: MockFn;
  getUserName: MockFn;
  getLogger: MockFn;
  dispatch: MockFn;
}

export function createSpyChatInstance(): SpyChatInstance {
  return {
    processMessage: createMockFn(),
    processEdit: createMockFn(),
    processDelete: createMockFn(),
    processReaction: createMockFn(),
    processTyping: createMockFn(),
    getState: mockResolvedValue({}),
    getUserName: mockResolvedValue("test-user"),
    getLogger: mockReturnValue({ info: createMockFn(), warn: createMockFn(), error: createMockFn() }),
    dispatch: mockResolvedValue(undefined),
  };
}

export function createTestMessage(
  id: string,
  text: string,
  overrides?: Partial<Message>,
): Message {
  return {
    id,
    text,
    sender: { id: "sender-1", name: "TestSender" },
    timestamp: Date.now(),
    threadId: "thread-1",
    ...overrides,
  };
}

export const mockLogger = {
  info: createMockFn(),
  warn: createMockFn(),
  error: createMockFn(),
  debug: createMockFn(),
};

export function createMockLogger() {
  return {
    info: createMockFn(),
    warn: createMockFn(),
    error: createMockFn(),
    debug: createMockFn(),
  };
}

export const matchers = {
  toHavePosted(adapter: SpyAdapter, threadId: string, textPattern?: RegExp | string) {
    const calls = adapter.postMessage.mock.calls.filter(
      ([tid]: [string]) => tid === threadId,
    );
    if (calls.length === 0) {
      return { pass: false, message: () => `adapter.postMessage was not called for thread "${threadId}"` };
    }
    if (textPattern) {
      const match = calls.some(([, msg]: [string, string]) => {
        if (typeof textPattern === "string") return msg.includes(textPattern);
        return textPattern.test(msg);
      });
      return {
        pass: match,
        message: () => `adapter.postMessage called for "${threadId}" but no call matched the text pattern`,
      };
    }
    return { pass: true, message: () => "" };
  },

  toHaveEdited(
    adapter: SpyAdapter,
    threadId: string,
    messageId: string,
    textPattern?: RegExp | string,
  ) {
    const calls = adapter.editMessage.mock.calls.filter(
      ([tid, mid]: [string, string]) => tid === threadId && mid === messageId,
    );
    if (calls.length === 0) {
      return { pass: false, message: () => `adapter.editMessage was not called for thread "${threadId}", message "${messageId}"` };
    }
    if (textPattern) {
      const match = calls.some(([, , msg]: [string, string, string]) => {
        if (typeof textPattern === "string") return msg.includes(textPattern);
        return textPattern.test(msg);
      });
      return {
        pass: match,
        message: () => `adapter.editMessage called for "${threadId}/${messageId}" but no call matched the text pattern`,
      };
    }
    return { pass: true, message: () => "" };
  },

  toHaveDeleted(adapter: SpyAdapter, threadId: string, messageId: string) {
    const calls = adapter.deleteMessage.mock.calls.filter(
      ([tid, mid]: [string, string]) => tid === threadId && mid === messageId,
    );
    return {
      pass: calls.length > 0,
      message: () => `adapter.deleteMessage was not called for thread "${threadId}", message "${messageId}"`,
    };
  },

  toHaveReactedWith(adapter: SpyAdapter, threadId: string, messageId: string, emoji: string) {
    const calls = adapter.addReaction.mock.calls.filter(
      ([tid, mid, em]: [string, string, string]) => tid === threadId && mid === messageId && em === emoji,
    );
    return {
      pass: calls.length > 0,
      message: () => `adapter.addReaction was not called with emoji "${emoji}" for "${threadId}/${messageId}"`,
    };
  },

  toHaveStartedTyping(adapter: SpyAdapter, threadId: string) {
    const calls = adapter.startTyping.mock.calls.filter(
      ([tid]: [string]) => tid === threadId,
    );
    return {
      pass: calls.length > 0,
      message: () => `adapter.startTyping was not called for thread "${threadId}"`,
    };
  },

  toHavePostedToChannel(adapter: SpyAdapter, channelId: string, textPattern?: RegExp | string) {
    const calls = adapter.postChannelMessage.mock.calls.filter(
      ([cid]: [string]) => cid === channelId,
    );
    if (calls.length === 0) {
      return { pass: false, message: () => `adapter.postChannelMessage was not called for channel "${channelId}"` };
    }
    if (textPattern) {
      const match = calls.some(([, msg]: [string, string]) => {
        if (typeof textPattern === "string") return msg.includes(textPattern);
        return textPattern.test(msg);
      });
      return {
        pass: match,
        message: () => `adapter.postChannelMessage called for "${channelId}" but no call matched the text pattern`,
      };
    }
    return { pass: true, message: () => "" };
  },

  toHaveDispatched(chat: SpyChatInstance, handler: string) {
    const calls = chat.dispatch.mock.calls.filter(
      ([h]: [string]) => h === handler,
    );
    return {
      pass: calls.length > 0,
      message: () => `chat.dispatch was not called with handler "${handler}"`,
    };
  },

  async toBeSubscribedTo(state: SpyStateAdapter, threadId: string) {
    const subbed = await state.isSubscribed(threadId);
    return {
      pass: subbed,
      message: () => `state.isSubscribed("${threadId}") did not return true`,
    };
  },
};

export function registerMatchers(expectFn: typeof expect) {
  expectFn.extend(matchers as Record<string, unknown>);
}
