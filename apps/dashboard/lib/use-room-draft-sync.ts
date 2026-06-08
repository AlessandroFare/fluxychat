"use client";

import { useEffect, useRef } from "react";
import type { FluxyChatClient } from "@fluxy-chat/sdk";

const DRAFT_DEBOUNCE_MS = 800;

export interface UseRoomDraftSyncOptions {
  client: FluxyChatClient | null;
  roomId: string;
  content: string;
  replyToId: number | null;
  onRestore: (draft: { content: string; replyToId: number | null }) => void;
  enabled?: boolean;
}

/**
 * Loads a server-side compose draft once on mount and debounces saves on change.
 */
export function useRoomDraftSync({
  client,
  roomId,
  content,
  replyToId,
  onRestore,
  enabled = true,
}: UseRoomDraftSyncOptions) {
  const hydratedRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  const trimmedRoomId = roomId.trim();

  useEffect(() => {
    hydratedRef.current = false;
    skipNextSaveRef.current = false;
    if (!enabled || !client?.isAuthenticated() || !trimmedRoomId) return;
    let cancelled = false;
    void client.getRoomDraft(trimmedRoomId).then((draft) => {
      if (cancelled || !draft || hydratedRef.current) return;
      hydratedRef.current = true;
      skipNextSaveRef.current = true;
      onRestoreRef.current({
        content: draft.content,
        replyToId: draft.replyToId,
      });
    }).catch(() => {
      hydratedRef.current = true;
    });
    return () => {
      cancelled = true;
    };
  }, [client, trimmedRoomId, enabled]);

  useEffect(() => {
    if (!enabled || !client?.isAuthenticated() || !trimmedRoomId) return;
    if (!hydratedRef.current) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void client
        .putRoomDraft(trimmedRoomId, { content, replyToId })
        .catch(() => undefined);
    }, DRAFT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [client, trimmedRoomId, content, replyToId, enabled]);
}
