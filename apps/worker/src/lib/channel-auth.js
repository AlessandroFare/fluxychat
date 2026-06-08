/**
 * Pusher-compatible private/presence channel auth (P10-P4).
 */
import { signWebhookPayload } from "./webhook-signing.js";

const CHANNEL_PREFIXES = ["private-room-", "presence-room-", "public-room-"];

/**
 * @param {string} channelName
 * @returns {string | null} roomId
 */
export function parseRoomIdFromChannelName(channelName) {
  if (!channelName || typeof channelName !== "string") return null;
  const trimmed = channelName.trim();
  for (const prefix of CHANNEL_PREFIXES) {
    if (trimmed.startsWith(prefix)) {
      const roomId = trimmed.slice(prefix.length);
      return roomId || null;
    }
  }
  if (/^[a-zA-Z0-9_-]{1,128}$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * @param {string} secret
 * @param {string} socketId
 * @param {string} channelName
 */
export async function signPusherStyleChannelAuth(secret, socketId, channelName) {
  const payload = `${socketId}:${channelName}`;
  const signature = await signWebhookPayload(secret, payload);
  const hex = signature.replace(/^sha256=/, "");
  return hex;
}

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   socketId: string,
 *   roomId: string,
 *   channelName?: string,
 *   presenceInfo?: Record<string, unknown>,
 * }} input
 */
export async function buildChannelAuthResponse(env, input) {
  const row = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ? LIMIT 1",
  )
    .bind(input.projectId)
    .first();

  if (!row?.jwt_secret) {
    return { ok: false, error: "project_secret_missing", status: 500 };
  }

  const channelName =
    input.channelName ||
    (input.presenceInfo ? `presence-room-${input.roomId}` : `private-room-${input.roomId}`);

  const signatureHex = await signPusherStyleChannelAuth(
    row.jwt_secret,
    input.socketId,
    channelName,
  );

  const auth = `${input.projectId}:${signatureHex}`;
  const channelData = input.presenceInfo
    ? JSON.stringify({
        user_id: input.userId,
        user_info: input.presenceInfo,
      })
    : undefined;

  return {
    ok: true,
    auth,
    channel_data: channelData,
    channelName,
    roomId: input.roomId,
    socketId: input.socketId,
  };
}
