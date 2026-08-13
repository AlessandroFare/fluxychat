/**
 * CP-062/063: Unified Chat API types and helpers (SDK-side).
 */

export interface FluxyThreadRef {
  id: string;
  adapterSlug: string;
  channelId: string;
  roomId?: string;
  created?: boolean;
}

export interface FluxyOpenDmResult {
  ok: boolean;
  thread: FluxyThreadRef;
  room?: { id: string; type: string } | null;
}

const SLACK_USER_ID_REGEX = /^[UW][A-Z0-9]+$/;
const DISCORD_SNOWFLAKE_REGEX = /^\d{17,19}$/;
const TEAMS_USER_ID_REGEX = /^29:/;
const GCHAT_USER_ID_REGEX = /^users\//;
const TELEGRAM_USER_ID_REGEX = /^\d{1,13}$/;

export function inferAdapterFromUserId(userId: string): string | null {
  if (!userId) return null;
  if (GCHAT_USER_ID_REGEX.test(userId)) return "gchat";
  if (TEAMS_USER_ID_REGEX.test(userId)) return "teams";
  if (SLACK_USER_ID_REGEX.test(userId)) return "slack";
  if (DISCORD_SNOWFLAKE_REGEX.test(userId)) return "discord";
  if (TELEGRAM_USER_ID_REGEX.test(userId)) return "telegram";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    return "web";
  }
  return null;
}

export function parseAdapterSlug(threadId: string): string | null {
  const idx = threadId.indexOf(":");
  if (idx <= 0) return null;
  return threadId.slice(0, idx) || null;
}

export function buildThreadId(adapterSlug: string, channelId: string, messageId?: string): string {
  return messageId ? `${adapterSlug}:${channelId}:${messageId}` : `${adapterSlug}:${channelId}:`;
}
