"use client";

import React from "react";
import * as Y from "yjs";
import { FluxyChatClient } from "./fluxy-chat-client";
import { decodeFluxyJwtPayload } from "./jwt-utils";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import { trimTrailingSlashes } from "./url-utils";
import {
  decodeYjsAwareness,
  decodeYjsFrame,
  encodeYjsAwareness,
  encodeYjsAwarenessLeave,
  encodeYjsFrame,
  isPermanentYjsClose,
  isYjsAwarenessLeave,
  YJS_MSG_AWARENESS,
  YJS_MSG_SYNC,
  YJS_MSG_UPDATE,
  type FluxyYjsAwarenessState,
} from "./yjs-binary";
import {
  FLUXY_YJS_EDITOR_FRAGMENT,
  FLUXY_YJS_STORAGE_MAP,
  storageMapToJson,
  type StorageJson,
} from "./yjs-storage";

export type FluxyYjsConnectionStatus = "connecting" | "connected" | "disconnected";

export interface FluxyYjsContextValue {
  doc: Y.Doc;
  storage: Y.Map<unknown>;
  undoManager: Y.UndoManager;
  connected: boolean;
  /** y-websocket `status` event. */
  status: FluxyYjsConnectionStatus;
  /** y-websocket `synced` — true after the first server sync frame. */
  synced: boolean;
  awareness: Map<string, FluxyYjsAwarenessState>;
  setLocalAwareness: (patch: Partial<FluxyYjsAwarenessState>) => void;
  client: FluxyChatClient;
  roomId: string;
}

const FluxyYjsContext = React.createContext<FluxyYjsContextValue | null>(null);

export interface FluxyYjsProviderProps {
  children: React.ReactNode;
  roomId: string;
  client?: FluxyChatClient;
  workerUrl?: string;
  token?: string;
  /** Same shape as FluxyRealtimeProvider — string JWT, or nest under that provider. */
  authTokenProvider?: string | (() => Promise<string>);
  userId?: string;
  /** y-websocket local awareness (name/color/cursor). */
  awareness?: FluxyYjsAwarenessState | null;
  /** y-websocket `maxBackoffTime` (ms). */
  maxBackoffTime?: number;
  /** y-websocket `resyncInterval` (ms). Off when <= 0. */
  resyncInterval?: number;
}

export function FluxyYjsProvider({
  children,
  roomId,
  client: clientProp,
  workerUrl,
  token,
  authTokenProvider,
  userId,
  awareness: awarenessProp,
  maxBackoffTime = 2500,
  resyncInterval = -1,
}: FluxyYjsProviderProps) {
  const realtime = useFluxyChatOptional();
  const [asyncToken, setAsyncToken] = React.useState<string | undefined>();

  React.useEffect(() => {
    if (typeof authTokenProvider !== "function") {
      setAsyncToken(undefined);
      return;
    }
    let cancelled = false;
    void authTokenProvider().then((next) => {
      if (!cancelled) setAsyncToken(next);
    });
    return () => {
      cancelled = true;
    };
  }, [authTokenProvider]);

  const resolvedToken =
    token ??
    (typeof authTokenProvider === "string" ? authTokenProvider : undefined) ??
    asyncToken ??
    realtime?.token ??
    undefined;

  const waiting =
    Boolean(!clientProp && realtime && !realtime.client) ||
    (typeof authTokenProvider === "function" && !resolvedToken && !realtime?.client);

  const client = React.useMemo(() => {
    if (clientProp) return clientProp;
    if (realtime?.client) return realtime.client;
    const uid =
      userId ?? (resolvedToken ? decodeFluxyJwtPayload(resolvedToken).sub : undefined) ?? "";
    if (!workerUrl || !resolvedToken || !uid) return null;
    return new FluxyChatClient({
      baseUrl: trimTrailingSlashes(workerUrl),
      token: resolvedToken,
      userId: uid,
    });
  }, [clientProp, realtime?.client, workerUrl, resolvedToken, userId]);

  const selfUserId = userId ?? client?.userId ?? "";
  const [status, setStatus] = React.useState<FluxyYjsConnectionStatus>("disconnected");
  const [connected, setConnected] = React.useState(false);
  const [synced, setSynced] = React.useState(false);
  const [awareness, setAwareness] = React.useState<Map<string, FluxyYjsAwarenessState>>(() => new Map());
  const [version, setVersion] = React.useState(0);
  const wsRef = React.useRef<WebSocket | null>(null);
  const localAwarenessRef = React.useRef<FluxyYjsAwarenessState | null>(awarenessProp ?? null);

  React.useEffect(() => {
    if (awarenessProp) localAwarenessRef.current = awarenessProp;
    else if (selfUserId) localAwarenessRef.current = { ...(localAwarenessRef.current ?? {}), userId: selfUserId };
  }, [awarenessProp, selfUserId]);

  const setLocalAwareness = React.useCallback((patch: Partial<FluxyYjsAwarenessState>) => {
    const prev = localAwarenessRef.current ?? { userId: selfUserId };
    const next: FluxyYjsAwarenessState = {
      ...prev,
      ...patch,
      userId: (patch.userId ?? prev.userId ?? selfUserId).trim(),
    };
    if (!next.userId) return;
    localAwarenessRef.current = next;
    setAwareness((map) => {
      const copy = new Map(map);
      copy.set(next.userId, next);
      return copy;
    });
    const socket = wsRef.current;
    if (socket?.readyState === WebSocket.OPEN) socket.send(encodeYjsAwareness(next));
  }, [selfUserId]);
  const hold = React.useRef<{
    doc: Y.Doc;
    storage: Y.Map<unknown>;
    undoManager: Y.UndoManager;
  } | null>(null);

  if (!hold.current) {
    const doc = new Y.Doc();
    const storage = doc.getMap(FLUXY_YJS_STORAGE_MAP);
    doc.getXmlFragment(FLUXY_YJS_EDITOR_FRAGMENT);
    hold.current = {
      doc,
      storage,
      undoManager: new Y.UndoManager([storage, doc.getXmlFragment(FLUXY_YJS_EDITOR_FRAGMENT)]),
    };
  }

  const { doc, storage, undoManager } = hold.current;

  React.useEffect(() => {
    let disposed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let resyncTimer: ReturnType<typeof setInterval> | null = null;
    let attempts = 0;
    let ws: WebSocket | null = null;
    let updateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;

    function openSocket() {
      if (disposed || !client) return;
      ws?.close();
      setStatus("connecting");
      const socket = client.connect(roomId, { replay: "off" });
      socket.binaryType = "arraybuffer";
      ws = socket;
      wsRef.current = socket;

      updateHandler = (update: Uint8Array, origin: unknown) => {
        if (origin === "remote" || origin === "load") return;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(encodeYjsFrame(YJS_MSG_UPDATE, update));
        }
      };
      doc.on("update", updateHandler);

      socket.onopen = () => {
        if (disposed) {
          socket.close();
          return;
        }
        attempts = 0;
        setConnected(true);
        setStatus("connected");
        socket.send(encodeYjsFrame(YJS_MSG_SYNC, Y.encodeStateAsUpdate(doc)));
        const local = localAwarenessRef.current;
        if (local?.userId) socket.send(encodeYjsAwareness(local));
      };

      socket.onmessage = (event) => {
        if (disposed || !(event.data instanceof ArrayBuffer)) return;
        const frame = decodeYjsFrame(new Uint8Array(event.data));
        if (!frame) return;
        if (
          (frame.type === YJS_MSG_SYNC || frame.type === YJS_MSG_UPDATE) &&
          frame.payload.byteLength > 0
        ) {
          Y.applyUpdate(doc, frame.payload, "remote");
          if (frame.type === YJS_MSG_SYNC) setSynced(true);
        }
        if (frame.type === YJS_MSG_AWARENESS) {
          const next = decodeYjsAwareness(frame.payload);
          if (!next || next.userId === selfUserId) return;
          setAwareness((map) => {
            const copy = new Map(map);
            if (isYjsAwarenessLeave(next)) copy.delete(next.userId);
            else copy.set(next.userId, next);
            return copy;
          });
        }
      };

      socket.onclose = (event) => {
        setConnected(false);
        setSynced(false);
        setStatus("disconnected");
        setAwareness((map) => {
          const local = localAwarenessRef.current;
          if (!local?.userId) return new Map();
          return new Map([[local.userId, local]]);
        });
        wsRef.current = null;
        if (updateHandler) doc.off("update", updateHandler);
        updateHandler = null;
        if (disposed) return;
        if (isPermanentYjsClose(event.code)) return;
        const delay = Math.min(500 * 2 ** attempts, maxBackoffTime);
        attempts += 1;
        reconnectTimer = setTimeout(openSocket, delay);
      };

      socket.onerror = () => socket.close();
    }

    if (!client) return undefined;

    const deep = () => setVersion((n) => n + 1);
    storage.observeDeep(deep);
    openSocket();
    if (resyncInterval > 0) {
      resyncTimer = setInterval(() => {
        const socket = wsRef.current;
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(encodeYjsFrame(YJS_MSG_SYNC, Y.encodeStateAsUpdate(doc)));
        }
      }, resyncInterval);
    }

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (resyncTimer) clearInterval(resyncTimer);
      storage.unobserveDeep(deep);
      if (updateHandler) doc.off("update", updateHandler);
      const socket = ws;
      const local = localAwarenessRef.current;
      if (socket?.readyState === WebSocket.OPEN && local?.userId) {
        try {
          socket.send(encodeYjsAwarenessLeave(local.userId));
        } catch {
          /* closing */
        }
      }
      ws?.close();
      setConnected(false);
      setStatus("disconnected");
    };
  }, [client, doc, roomId, storage, selfUserId, maxBackoffTime, resyncInterval]);

  const value = React.useMemo<FluxyYjsContextValue | null>(
    () =>
      client
        ? {
            doc,
            storage,
            undoManager,
            connected,
            status,
            synced,
            awareness,
            setLocalAwareness,
            client,
            roomId,
          }
        : null,
    [client, connected, status, synced, awareness, setLocalAwareness, doc, roomId, storage, undoManager, version],
  );

  if (!client || !value) {
    if (waiting) return null;
    throw new Error(
      "FluxyYjsProvider needs client, a parent FluxyRealtimeProvider, or workerUrl + token (or authTokenProvider) + userId",
    );
  }

  return <FluxyYjsContext.Provider value={value}>{children}</FluxyYjsContext.Provider>;
}

export function useYjsContext(): FluxyYjsContextValue {
  const ctx = React.useContext(FluxyYjsContext);
  if (!ctx) throw new Error("Yjs storage hooks need FluxyYjsProvider");
  return ctx;
}

export function useYjsDoc(): Y.Doc {
  return useYjsContext().doc;
}

export function useStorage<T>(selector: (root: StorageJson) => T): T {
  const { storage } = useYjsContext();
  const selectorRef = React.useRef(selector);
  selectorRef.current = selector;
  const [selected, setSelected] = React.useState(() => selector(storageMapToJson(storage)));

  React.useEffect(() => {
    const sync = () => setSelected(selectorRef.current(storageMapToJson(storage)));
    sync();
    storage.observeDeep(sync);
    return () => storage.unobserveDeep(sync);
  }, [storage]);

  return selected;
}

export function useMutation<TArgs extends unknown[]>(
  mutator: (storage: Y.Map<unknown>, ...args: TArgs) => void,
  deps: React.DependencyList,
): (...args: TArgs) => void {
  const { doc, storage } = useYjsContext();
  const mutatorRef = React.useRef(mutator);
  mutatorRef.current = mutator;
  return React.useCallback((...args: TArgs) => {
    doc.transact(() => {
      mutatorRef.current(storage, ...args);
    }, "storage");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Liveblocks-shaped deps array
  }, deps);
}

export function useUndo(): () => void {
  const { undoManager } = useYjsContext();
  return React.useCallback(() => undoManager.undo(), [undoManager]);
}

export function useRedo(): () => void {
  const { undoManager } = useYjsContext();
  return React.useCallback(() => undoManager.redo(), [undoManager]);
}

/** y-websocket `awareness.getStates()` as a Map keyed by userId. */
export function useAwareness(): Map<string, FluxyYjsAwarenessState> {
  return useYjsContext().awareness;
}

/** y-websocket provider `status` event. */
export function useYjsStatus(): FluxyYjsConnectionStatus {
  return useYjsContext().status;
}
