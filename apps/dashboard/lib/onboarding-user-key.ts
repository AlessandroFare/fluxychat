import { loadQuickstartProgress } from "@/lib/quickstart-progress";

/** Stable per-user key for quickstart progress (Clerk or self-host). */
export function resolveQuickstartUserKey(
  clerkUserId: string | null | undefined,
  memberUserId: string,
): string | null {
  if (clerkUserId?.trim()) return clerkUserId.trim();
  const uid = memberUserId.trim();
  if (uid) return `self-host-${uid}`;
  return null;
}

export function readFirstMessageSentForUser(
  clerkUserId: string | null | undefined,
  memberUserId: string,
): boolean {
  const key = resolveQuickstartUserKey(clerkUserId, memberUserId);
  if (!key) return false;
  return Boolean(loadQuickstartProgress(key).firstMessageSent);
}
