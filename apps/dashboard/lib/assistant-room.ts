/** Default room for in-console agent chat (Phase 1 beta UX). Must match worker `isValidId`. */
export function assistantRoomId(projectId: string): string {
  return `assistant-${projectId}`;
}
export const ASSISTANT_ROOM_DISPLAY_NAME = "Assistant (general)";
/** Legacy id from early betas (colon invalid for worker room ids). */
export const LEGACY_ASSISTANT_ROOM_ID = "assistant:general";

export interface AssistantRoomRef {
  id: string;
  type: string;
  name: string;
  created_at: string;
}

export function normalizeAgentHandle(handle: string | null | undefined): string {
  if (!handle) return "";
  return handle.replace(/^@/, "").trim().toLowerCase();
}

/** Prefer built-in @assistant, then @onboarding, else first agent in list. */
export function pickDefaultAssistantAgent<
  T extends { id: string; handle?: string | null },
>(agents: T[]): T | null {
  if (!agents.length) return null;
  const match = (target: string) =>
    agents.find((a) => normalizeAgentHandle(a.handle) === target);
  return match("assistant") ?? match("onboarding") ?? agents[0] ?? null;
}

export function mentionPrefixForAgent(handle: string | null | undefined): string {
  const h = normalizeAgentHandle(handle);
  return h ? `@${h} ` : "";
}
