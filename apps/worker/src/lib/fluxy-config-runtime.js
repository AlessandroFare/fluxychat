import fluxyConfig from "../../fluxy.config.js";
import {
  runRoomAuthz,
  runPublishMiddleware,
  runDisconnectMiddleware,
  getClientDefaults,
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

export async function runFluxyRoomAuthz(roomId, auth) {
  const anonymous = isAnonymousAuth(auth);
  return runRoomAuthz(getFluxyConfig(), {
    roomId,
    userId: auth?.userId ?? "unknown",
    claims: auth?.claims ?? {},
    anonymous,
  });
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

  const row = await env.DB.prepare(
    "SELECT deny_substrings, guest_can_publish FROM project_publish_config WHERE project_id = ? LIMIT 1",
  )
    .bind(projectId)
    .first()
    .catch(() => null);

  if (!row) return fileResult;

  if (row.guest_can_publish === 0 && isGuestOnlyAuth(auth)) {
    return { ok: false, reason: "Guests cannot publish in this project." };
  }

  let deny = [];
  try {
    deny = JSON.parse(row.deny_substrings || "[]");
  } catch {
    deny = [];
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
