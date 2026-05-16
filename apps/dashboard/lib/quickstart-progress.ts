/**
 * Per-Clerk-user quickstart completion (localStorage).
 * Required before console overview; agent step (6) is optional.
 */

import { purgeLegacyUnscopedKeys, scopedStorageKey } from "@/lib/scoped-browser-storage";

export const QUICKSTART_STORAGE_BASE = "fluxychat.quickstart.progress.v1";

/** @deprecated Unscoped key — cleared on sign-in; do not read. */
export const QUICKSTART_STORAGE_KEY = QUICKSTART_STORAGE_BASE;

export interface QuickstartProgress {
  clerkUserId?: string;
  completedAt?: string;
  firstMessageSent?: boolean;
}

export interface QuickstartSessionSnapshot {
  adminJwt: string;
  memberJwt: string;
  activeProjectId: string | null;
  lastRoomId: string | null;
}

function progressKey(clerkUserId: string): string {
  return scopedStorageKey(QUICKSTART_STORAGE_BASE, clerkUserId);
}

export function purgeLegacyQuickstartStorage(): void {
  purgeLegacyUnscopedKeys([QUICKSTART_STORAGE_BASE]);
}

export function loadQuickstartProgress(clerkUserId: string | null | undefined): QuickstartProgress {
  if (typeof window === "undefined" || !clerkUserId) return {};
  try {
    const raw = window.localStorage.getItem(progressKey(clerkUserId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QuickstartProgress;
    if (parsed.clerkUserId && parsed.clerkUserId !== clerkUserId) return {};
    return parsed;
  } catch {
    return {};
  }
}

export function saveQuickstartProgress(
  clerkUserId: string,
  patch: Omit<QuickstartProgress, "clerkUserId">,
): void {
  if (typeof window === "undefined") return;
  const next: QuickstartProgress = {
    ...loadQuickstartProgress(clerkUserId),
    ...patch,
    clerkUserId,
  };
  window.localStorage.setItem(progressKey(clerkUserId), JSON.stringify(next));
}

export function markQuickstartFirstMessage(clerkUserId: string): void {
  saveQuickstartProgress(clerkUserId, { firstMessageSent: true });
}

export function markQuickstartComplete(clerkUserId: string): void {
  saveQuickstartProgress(clerkUserId, {
    completedAt: new Date().toISOString(),
    firstMessageSent: true,
  });
}

function progressBelongsToUser(progress: QuickstartProgress, clerkUserId: string): boolean {
  if (!progress.clerkUserId) return false;
  return progress.clerkUserId === clerkUserId;
}

/** Required steps done for this Clerk user only. */
export function isQuickstartComplete(
  clerkUserId: string | null | undefined,
  session: QuickstartSessionSnapshot,
  progress: QuickstartProgress = loadQuickstartProgress(clerkUserId),
): boolean {
  if (!clerkUserId) return false;
  if (!progressBelongsToUser(progress, clerkUserId)) return false;

  if (progress.completedAt) return true;

  return (
    session.adminJwt.trim().length >= 12 &&
    Boolean(session.activeProjectId) &&
    session.memberJwt.trim().length >= 12 &&
    Boolean(session.lastRoomId) &&
    Boolean(progress.firstMessageSent)
  );
}
