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
  return runPublishMiddleware(getFluxyConfig(), roomId, {
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
}

export async function runFluxyDisconnectHooks(roomId, userId, reason) {
  await runDisconnectMiddleware(getFluxyConfig(), { roomId, userId, reason });
}
