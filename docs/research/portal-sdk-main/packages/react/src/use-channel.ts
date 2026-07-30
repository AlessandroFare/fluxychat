import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { ChannelHandle, ChannelSnapshot, SendAck, SendInput } from "@portalsdk/core";

import { usePortal } from "./context.js";
import { isServerEnvironment } from "./ssr.js";
import type { UseChannelParams, UseChannelResult } from "./types.js";
import { useLatest } from "./use-latest.js";

/**
 * Inert snapshot for the "nothing selected" state (`channelId: undefined`) and for server
 * rendering (`typeof window === "undefined"`) alike — both mean no handle exists.
 *
 * A single frozen module constant so `getSnapshot`/`getServerSnapshot` return a referentially
 * stable value while inert — `useSyncExternalStore` compares snapshots by identity, and a
 * fresh object each call would loop.
 */
const INERT_SNAPSHOT: ChannelSnapshot<never> = Object.freeze({
  messages: Object.freeze([]) as readonly never[],
  presence: undefined,
  activity: Object.freeze([]) as readonly never[],
  status: "idle",
  unread: 0,
  info: undefined,
  me: undefined,
  isLoadingPrevious: false,
  hasPrevious: false,
});

/**
 * Subscribe to one channel. A thin binding over the core {@link ChannelHandle}: it
 * resolves the handle from the registry, drives the refcount from mount/unmount, and mirrors
 * the handle's store through `useSyncExternalStore`. All state lives in core.
 *
 * During server rendering (`typeof window === "undefined"`, which includes a Next.js Client
 * Component's server prerender pass despite `"use client"`), this renders the same inert
 * snapshot as `channelId: undefined` — no handle is created, so there is no acquire, no
 * network, and no effect registration. On an actual client this branch never engages.
 */
export function useChannel<M = unknown>(
  params: UseChannelParams<M>,
): UseChannelResult<M> {
  const portal = usePortal();
  const {
    channelId,
    readOn = "mount",
    history,
    metadata,
    where,
    onMention,
    onMessage,
    onError,
  } = params;

  // Same handle object per id (core's registry). `history`/`metadata` are connect-time only
  // and first-creation-wins in core, so they are intentionally not dependencies — changing
  // them without changing `channelId` does not (and should not) re-create the handle.
  const handle = useMemo<ChannelHandle<M> | undefined>(
    () =>
      channelId === undefined || isServerEnvironment()
        ? undefined
        : portal.channel<M>(channelId, {
            ...(history !== undefined && { history }),
            ...(metadata !== undefined && { metadata }),
          }),
    [portal, channelId],
  );

  // `where` on a channel is a reserved surface: core's view() rejects it at runtime. Run it
  // through core so the rejection (NotYetSupportedError) surfaces loudly.
  useMemo(() => {
    if (handle && where !== undefined) handle.view(where);
  }, [handle, where]);

  const onMentionRef = useLatest(onMention);
  const onMessageRef = useLatest(onMessage);
  const onErrorRef = useLatest(onError);

  // Refcount: mount acquires, unmount (or id change) releases. Core's grace window absorbs
  // StrictMode's double-invoke and fast remounts, so this naive pairing is correct. Never
  // runs server-side: effects don't fire during server rendering, and handle is undefined
  // there regardless.
  useEffect(() => {
    if (!handle) return;
    handle.acquire();
    return () => handle.release();
  }, [handle]);

  // readOn: watermark auto-advance policy (core owns markAsRead; the visibility wiring is ours).
  useEffect(() => {
    if (!handle || readOn === "manual") return;
    if (readOn === "mount") {
      handle.markAsRead();
      return;
    }
    // "visible": advance on a visible mount, then on each transition back to visible.
    if (document.visibilityState === "visible") handle.markAsRead();
    const onVisibility = () => {
      if (document.visibilityState === "visible") handle.markAsRead();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [handle, readOn]);

  // Callback props. There is no channel `error` event — in-session errors ride the `status`
  // event's second argument (the status value itself may be unchanged), so onError maps from
  // there. Reads go through refs so inline callbacks don't churn this subscription.
  useEffect(() => {
    if (!handle) return;
    const offMessage = handle.on("message", (msg) => onMessageRef.current?.(msg));
    const offMention = handle.on("mention", (msg) => onMentionRef.current?.(msg));
    const offStatus = handle.on("status", (_status, err) => {
      if (err) onErrorRef.current?.(err);
    });
    return () => {
      offMessage();
      offMention();
      offStatus();
    };
  }, [handle, onMessageRef, onMentionRef, onErrorRef]);

  const subscribe = useCallback(
    (listener: () => void) => (handle ? handle.subscribe(listener) : () => {}),
    [handle],
  );
  const getSnapshot = useCallback(
    (): ChannelSnapshot<M> => (handle ? handle.getSnapshot() : INERT_SNAPSHOT),
    [handle],
  );
  // Called during server rendering, and during the client's first (pre-hydration) render to
  // check consistency with the server output. `handle` is always undefined server-side, so
  // this is the same inert value `getSnapshot` would already return there — provided
  // explicitly because useSyncExternalStore requires it to render on the server at all.
  const getServerSnapshot = useCallback((): ChannelSnapshot<M> => INERT_SNAPSHOT, []);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const send = useCallback(
    (input: SendInput<M>): Promise<SendAck> =>
      handle
        ? handle.send(input)
        : Promise.reject(new Error("Cannot send: no channel selected (channelId is undefined).")),
    [handle],
  );
  const loadPrevious = useCallback(
    (): Promise<boolean> => (handle ? handle.loadPrevious() : Promise.resolve(false)),
    [handle],
  );
  const sendActivity = useCallback((kind: string) => handle?.sendActivity(kind), [handle]);
  const sendTyping = useCallback(() => handle?.sendTyping(), [handle]);
  const markAsRead = useCallback(() => handle?.markAsRead(), [handle]);
  const setMetadata = useCallback(
    (meta: Record<string, unknown>) => handle?.setMetadata(meta),
    [handle],
  );

  const typing = useMemo(
    () => snapshot.activity.filter((a) => a.kind === "typing").map((a) => a.userId),
    [snapshot.activity],
  );

  return {
    messages: snapshot.messages,
    send,
    loadPrevious,
    isLoadingPrevious: snapshot.isLoadingPrevious,
    hasPrevious: snapshot.hasPrevious,
    channel: snapshot.info,
    me: snapshot.me,
    presence: snapshot.presence,
    activity: snapshot.activity,
    sendActivity,
    typing,
    sendTyping,
    unread: snapshot.unread,
    markAsRead,
    setMetadata,
    status: snapshot.status,
  };
}
