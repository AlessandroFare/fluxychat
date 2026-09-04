import fluxyConfig from "../../fluxy.config.js";
import {
  runRoomAuthz,
  runPublishMiddleware,
  runDisconnectMiddleware,
  getClientDefaults,
  resolveRoomConfig,
} from "@fluxy-chat/config";
import { isGuestOnlyAuth } from "./guest-auth.js";

export function getFluxyConfig() {
  return fluxyConfig ?? null;
}

export function getFluxyClientDefaults() {
  return getClientDefaults(getFluxyConfig());
}

export function isAnonymousAuth(auth) {
  return isGuestOnlyAuth(auth);
}

function parseRoomsJson(raw) {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadProjectPublishConfig(env, projectId) {
  if (!env?.DB || !projectId) return null;
  try {
    return await env.DB.prepare(
      "SELECT deny_substrings, guest_can_publish, iot_auto_agent_id, rooms_json FROM project_publish_config WHERE project_id = ? LIMIT 1",
    )
      .bind(projectId)
      .first();
  } catch {
    return env.DB.prepare(
      "SELECT deny_substrings, guest_can_publish, iot_auto_agent_id FROM project_publish_config WHERE project_id = ? LIMIT 1",
    )
      .bind(projectId)
      .first()
      .catch(() => null);
  }
}

export function hostedRoomsAsConfig(row) {
  if (!row) return null;
  const rooms = parseRoomsJson(row.rooms_json);
  if (!Object.keys(rooms).length) return null;
  return { rooms };
}

export async function runFluxyRoomAuthz(roomId, auth, extras = {}) {
  const anonymous = isAnonymousAuth(auth);
  const ctx = {
    roomId,
    userId: auth?.userId ?? "unknown",
    claims: auth?.claims ?? {},
    anonymous,
  };
  const fileResult = await runRoomAuthz(getFluxyConfig(), ctx);
  if (fileResult.action === "block") return fileResult;

  const row = await loadProjectPublishConfig(extras.env, auth?.projectId);
  const overlayConfig = hostedRoomsAsConfig(row);
  if (!overlayConfig) return fileResult;

  const overlayRoom = resolveRoomConfig(overlayConfig, roomId);
  if (overlayRoom.anonymous === false && anonymous) {
    return { action: "block", reason: "Sign in to join this room." };
  }

  return {
    action: "allow",
    capabilities: {
      ...fileResult.capabilities,
      ...(overlayRoom.capabilities ?? {}),
    },
  };
}

export async function runFluxyPublishPipeline(roomId, auth, content, extras = {}) {
  const fileResult = await runPublishMiddleware(getFluxyConfig(), roomId, {
    roomId,
    userId: auth?.userId ?? "unknown",
    capabilities: extras.capabilities,
    message: {
      content,
      rawContent: String(content ?? ""),
      replyTo: extras.replyTo ?? null,
      attachments: extras.attachments,
    },
  });
  if (!fileResult.ok) return fileResult;

  const env = extras.env;
  const projectId = auth?.projectId;
  if (!env?.DB || !projectId) return fileResult;

  const row = await loadProjectPublishConfig(env, projectId);
  if (!row) return fileResult;

  const overlayConfig = hostedRoomsAsConfig(row);
  const overlayRoom = overlayConfig ? resolveRoomConfig(overlayConfig, roomId) : {};

  const guestBlocked =
    (overlayRoom.guestCanPublish === false ||
      (overlayRoom.guestCanPublish == null && row.guest_can_publish === 0)) &&
    isGuestOnlyAuth(auth);
  if (guestBlocked) {
    return { ok: false, reason: "Guests cannot publish in this project." };
  }

  let deny = [];
  try {
    deny = JSON.parse(row.deny_substrings || "[]");
  } catch {
    deny = [];
  }
  if (Array.isArray(overlayRoom.denySubstrings) && overlayRoom.denySubstrings.length) {
    deny = [...deny, ...overlayRoom.denySubstrings];
  }
  const text = String(fileResult.content ?? "");
  const hit = Array.isArray(deny)
    ? deny.find((s) => typeof s === "string" && s && text.toLowerCase().includes(s.toLowerCase()))
    : null;
  if (hit) {
    return { ok: false, reason: "Message blocked by project publish rules." };
  }
  return fileResult;
}

export async function runFluxyDisconnectHooks(roomId, userId, reason) {
  await runDisconnectMiddleware(getFluxyConfig(), { roomId, userId, reason });
}
