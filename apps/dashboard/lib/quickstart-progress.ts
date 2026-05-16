/**
 * Hosted quickstart completion — persisted in localStorage (survives tab close).
 * Required before console overview; agent step (6) is optional.
 */

export const QUICKSTART_STORAGE_KEY = "fluxychat.quickstart.progress.v1";

export interface QuickstartProgress {
  completedAt?: string;
  firstMessageSent?: boolean;
}

export interface QuickstartSessionSnapshot {
  adminJwt: string;
  memberJwt: string;
  activeProjectId: string | null;
  lastRoomId: string | null;
}

export function loadQuickstartProgress(): QuickstartProgress {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(QUICKSTART_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as QuickstartProgress;
  } catch {
    return {};
  }
}

export function saveQuickstartProgress(patch: QuickstartProgress): void {
  if (typeof window === "undefined") return;
  const next = { ...loadQuickstartProgress(), ...patch };
  window.localStorage.setItem(QUICKSTART_STORAGE_KEY, JSON.stringify(next));
}

export function markQuickstartFirstMessage(): void {
  saveQuickstartProgress({ firstMessageSent: true });
}

export function markQuickstartComplete(): void {
  saveQuickstartProgress({
    completedAt: new Date().toISOString(),
    firstMessageSent: true,
  });
}

/** Required steps done: connect, project, member JWT, room, first message. */
export function isQuickstartComplete(
  session: QuickstartSessionSnapshot,
  progress: QuickstartProgress = loadQuickstartProgress(),
): boolean {
  if (progress.completedAt) return true;
  return (
    session.adminJwt.trim().length >= 12 &&
    Boolean(session.activeProjectId) &&
    session.memberJwt.trim().length >= 12 &&
    Boolean(session.lastRoomId) &&
    Boolean(progress.firstMessageSent)
  );
}
