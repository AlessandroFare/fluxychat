"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import * as Y from "yjs";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const WORKER_URL = getPublicWorkerUrl();

interface AwarenessState {
  userId: string; name?: string; color?: string;
  cursor?: { x: number; y: number } | null;
}

interface YjsContextValue {
  doc: Y.Doc | null;
  connected: boolean;
  undoManager: Y.UndoManager | null;
  awareness: Map<string, AwarenessState>;
  ymap: Y.Map<any> | null;
  yarray: Y.Array<any> | null;
  ytext: Y.Text | null;
}

const YjsContext = createContext<YjsContextValue>({
  doc: null, connected: false, undoManager: null,
  awareness: new Map(), ymap: null, yarray: null, ytext: null,
});

export function useYjs() { return useContext(YjsContext); }

export function YjsProvider({ children, roomId, userId, token, userName, userColor }: {
  children: React.ReactNode; roomId: string; userId: string; token: string;
  userName?: string; userColor?: string;
}) {
  const docRef = useRef<Y.Doc | null>(null);
  const undoRef = useRef<Y.UndoManager | null>(null);
  const [connected, setConnected] = useState(false);
  const [awareness, setAwareness] = useState<Map<string, AwarenessState>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);

  const wsUrl = useMemo(() => `${WORKER_URL.replace(/^http/, "ws")}/ws/room/${roomId}?token=${encodeURIComponent(token)}`, [roomId, token]);

  const connect = useCallback(() => {
    if (destroyedRef.current) return;
    wsRef.current?.close();
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      if (destroyedRef.current) { ws.close(); return; }
      setConnected(true);
      const doc = docRef.current;
      if (doc) {
        const sv = Y.encodeStateAsUpdate(doc);
        const msg = new Uint8Array(1 + sv.byteLength);
        msg[0] = 0; msg.set(sv, 1);
        ws.send(msg);
      }
      if (userName) {
        const aw = new TextEncoder().encode(JSON.stringify({ userId, name: userName, color: userColor || "#6366f1" }));
        const aMsg = new Uint8Array(1 + aw.byteLength);
        aMsg[0] = 2; aMsg.set(aw, 1);
        ws.send(aMsg);
      }
    };

    ws.onmessage = (event) => {
      if (destroyedRef.current) return;
      if (!(event.data instanceof ArrayBuffer)) return;
      const data = new Uint8Array(event.data);
      if (data.byteLength < 1) return;
      const type = data[0];
      const payload = data.slice(1);
      const doc = docRef.current;
      if (!doc) return;

      if (type === 0) {
        if (payload.byteLength > 0) Y.applyUpdate(doc, payload, "remote");
      } else if (type === 1) {
        if (payload.byteLength > 0) Y.applyUpdate(doc, payload, "remote");
      } else if (type === 2) {
        try {
          const aw = JSON.parse(new TextDecoder().decode(payload)) as AwarenessState;
          if (aw.userId !== userId) {
            setAwareness((prev) => { const next = new Map(prev); next.set(aw.userId, aw); return next; });
          }
        } catch { /* ignore */ }
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (!destroyedRef.current) {
        reconnectRef.current = setTimeout(connect, 2000);
      }
    };

    ws.onerror = () => ws.close();
  }, [wsUrl, userId, userName, userColor]);

  useEffect(() => {
    const doc = new Y.Doc();
    docRef.current = doc;
    const ymap = doc.getMap("shared");
    const yarray = doc.getArray("elements");
    const ytext = doc.getText("content");
    const undo = new Y.UndoManager([ytext, yarray], { trackedOrigins: new Set([null]) });
    undoRef.current = undo;

    connect();

    const handler = (update: Uint8Array, origin: any) => {
      if (origin !== "remote" && origin !== "load" && wsRef.current?.readyState === WebSocket.OPEN) {
        const msg = new Uint8Array(1 + update.byteLength);
        msg[0] = 1; msg.set(update, 1);
        wsRef.current.send(msg);
      }
    };
    doc.on("update", handler);

    return () => {
      destroyedRef.current = true;
      doc.off("update", handler);
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      wsRef.current?.close();
      doc.destroy();
      docRef.current = null;
      undoRef.current = null;
    };
  }, [connect]);

  return (
    <YjsContext.Provider value={{
      doc: docRef.current,
      connected,
      undoManager: undoRef.current,
      awareness,
      ymap: docRef.current?.getMap("shared") ?? null,
      yarray: docRef.current?.getArray("elements") ?? null,
      ytext: docRef.current?.getText("content") ?? null,
    }}>
      {children}
    </YjsContext.Provider>
  );
}
