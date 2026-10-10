"use client";

import { useFluxyChat } from "./use-fluxy-chat";

/** Ably `useChatClient`: current user id from FluxyRealtimeProvider. */
export function useChatClient() {
  const ctx = useFluxyChat();
  return { clientId: ctx.userId, client: ctx.client };
}
