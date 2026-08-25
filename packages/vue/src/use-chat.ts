import { shallowRef, computed, onMounted, onUnmounted } from "vue";
import {
  createFluxyRoomStore,
  startFluxyRoomSession,
  acquireFluxyRoomSession,
  sessionTokenFingerprint,
  describeConnectionError,
  type UseChatOptions,
} from "@fluxy-chat/sdk";

/** NW-111 — Vue 3 composable mirroring React `useChat`. */
export function useChat(options: UseChatOptions) {
  const store = createFluxyRoomStore();
  const snapshot = shallowRef(store.getState());

  let unsubscribe: (() => void) | null = null;
  let releaseSession: (() => void) | null = null;

  const effectiveHistoryLimit = options.replayLimit ?? options.historyLimit ?? 50;
  const effectiveReadOn = options.markReadLatest ? "mount" : (options.readOn ?? "manual");

  onMounted(() => {
    const client = options.client;
    if (!client) return;

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

    unsubscribe = store.subscribe(() => {
      snapshot.value = store.getState();
    });
  });

  onUnmounted(() => {
    unsubscribe?.();
    releaseSession?.();
    unsubscribe = null;
    releaseSession = null;
  });

  const connectionErrorInfo = computed(() =>
    describeConnectionError(snapshot.value.connectionError),
  );

  return {
    messages: computed(() => snapshot.value.messages),
    hasMore: computed(() => snapshot.value.hasMore),
    isLoadingMore: computed(() => snapshot.value.isLoadingMore),
    historyLoaded: computed(() => snapshot.value.historyLoaded),
    loadHistory: () => snapshot.value.loadHistory(),
    loadMore: () => snapshot.value.loadMore(),
    connected: computed(() => snapshot.value.connected),
    connectionStatus: computed(() => snapshot.value.connectionStatus),
    connectionError: computed(() => snapshot.value.connectionError),
    connectionErrorInfo,
    online: computed(() => snapshot.value.online),
    typingUsers: computed(() => snapshot.value.typingUsers),
    sendMessage: (content: string, opts?: Parameters<typeof snapshot.value.sendMessage>[1]) =>
      snapshot.value.sendMessage(content, opts),
    invokeAgent: (content: string, opts?: { agentId?: string; replyTo?: number | null }) =>
      snapshot.value.invokeAgent(content, opts),
    stopAgentStream: (targetUserId?: string) => snapshot.value.stopAgentStream(targetUserId),
    store,
  };
}

export type { UseChatOptions };
