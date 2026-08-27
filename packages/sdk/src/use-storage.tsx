"use client";

import React from "react";
import * as Y from "yjs";
import { FluxyChatClient } from "./fluxy-chat-client";
import { decodeFluxyJwtPayload } from "./jwt-utils";
import { useFluxyChatOptional } from "./use-fluxy-chat";
import { trimTrailingSlashes } from "./url-utils";
import { decodeYjsFrame, encodeYjsFrame, YJS_MSG_SYNC, YJS_MSG_UPDATE } from "./yjs-binary";
import {
  FLUXY_YJS_EDITOR_FRAGMENT,
  FLUXY_YJS_STORAGE_MAP,
  storageMapToJson,
  type StorageJson,
} from "./yjs-storage";

export interface FluxyYjsContextValue {
  doc: Y.Doc;
  storage: Y.Map<unknown>;
  undoManager: Y.UndoManager;
  connected: boolean;
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
}

export function FluxyYjsProvider({
  children,
  roomId,
  client: clientProp,
  workerUrl,
  token,
  authTokenProvider,
  userId,
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

  const [connected, setConnected] = React.useState(false);
  const [version, setVersion] = React.useState(0);
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
    let ws: WebSocket | null = null;
    let updateHandler: ((update: Uint8Array, origin: unknown) => void) | null = null;

    function openSocket() {
      if (disposed || !client) return;
      ws?.close();
      const socket = client.connect(roomId, { replay: "off" });
      socket.binaryType = "arraybuffer";
      ws = socket;

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
        setConnected(true);
        socket.send(encodeYjsFrame(YJS_MSG_SYNC, Y.encodeStateAsUpdate(doc)));
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
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (updateHandler) doc.off("update", updateHandler);
        updateHandler = null;
        if (!disposed) reconnectTimer = setTimeout(openSocket, 2000);
      };

      socket.onerror = () => socket.close();
    }

    if (!client) return undefined;

    const deep = () => setVersion((n) => n + 1);
    storage.observeDeep(deep);
    openSocket();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      storage.unobserveDeep(deep);
      if (updateHandler) doc.off("update", updateHandler);
      ws?.close();
      setConnected(false);
    };
  }, [client, doc, roomId, storage]);

  const value = React.useMemo<FluxyYjsContextValue | null>(
    () =>
      client
        ? { doc, storage, undoManager, connected, client, roomId }
        : null,
    [client, connected, doc, roomId, storage, undoManager, version],
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
