import { readable, type Readable } from "svelte/store";
import {
  createFluxyRoomStore,
  startFluxyRoomSession,
  acquireFluxyRoomSession,
  sessionTokenFingerprint,
  type UseChatOptions,
  type FluxyRoomStoreState,
} from "@fluxy-chat/sdk";

/** NW-111 — Svelte readable store mirroring React `useChat`. */
export function useChat(options: UseChatOptions): Readable<FluxyRoomStoreState> & {
  sendMessage: FluxyRoomStoreState["sendMessage"];
  loadHistory: () => void;
  loadMore: () => void;
} {
  const store = createFluxyRoomStore();
  const effectiveHistoryLimit = options.replayLimit ?? options.historyLimit ?? 50;
  const effectiveReadOn = options.markReadLatest ? "mount" : (options.readOn ?? "manual");

  let releaseSession: (() => void) | null = null;
  const client = options.client;

  if (client) {
    const sessionKey = `${client.userId ?? "none"}:${options.roomId}:${sessionTokenFingerprint(client.token ?? null)}`;
    releaseSession = acquireFluxyRoomSession(sessionKey, () =>
      startFluxyRoomSession(store, {
        roomId: options.roomId,
        client,
        agentId: options.agentId,
        historyLimit: effectiveHistoryLimit,
        replay: options.replay ?? "connect",
        replayHistoryOnReconnect: options.replayHistoryOnReconnect ?? true,
        readOn: effectiveReadOn,
        presenceInfo: options.presenceInfo,
        wsCache: options.wsCache ?? "on",
        e2eKey: options.e2eKey,
        e2eAutoFetch: options.e2eAutoFetch,
        crdtMessageList: options.crdtMessageList ?? true,
        concurrency: options.concurrency ?? { strategy: "debounce", debounceMs: 300 },
        onAnyEvent: options.onAnyEvent,
        onServerEvent: options.onServerEvent,
      }),
    );
  }

  const stateStore = readable(store.getState(), (set) => {
    const unsub = store.subscribe(() => set(store.getState()));
    return () => {
      unsub();
      releaseSession?.();
    };
  });

  return Object.assign(stateStore, {
    sendMessage: (...args: Parameters<FluxyRoomStoreState["sendMessage"]>) =>
      store.getState().sendMessage(...args),
    loadHistory: () => store.getState().loadHistory(),
    loadMore: () => store.getState().loadMore(),
  });
}

export type { UseChatOptions };
