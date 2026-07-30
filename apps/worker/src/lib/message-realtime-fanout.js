import { fanoutRoomInternal } from "./room-shard.js";
import { deliverWebhooks } from "./webhook-delivery.js";
import { maybeSyncMatrixOutboundForMessage } from "./matrix-outbound-hook.js";

/**
 * Push a D1-persisted message to connected room clients and project webhooks.
 * Used by admin import, omnichannel bridges, and telco inbound.
 */
export async function fanoutPersistedMessage(
  env,
  {
    projectId,
    roomId,
    messageId,
    userId,
    content,
    createdAt,
    clientMessageId,
    parentId,
    kind,
    source,
  },
) {
  const createdAtIso = createdAt || new Date().toISOString();

  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      roomId,
      id: messageId,
      userId,
      senderId: userId,
      content,
      createdAt: createdAtIso,
      parentId: parentId ?? null,
      ...(clientMessageId ? { clientMessageId } : {}),
      ...(kind ? { kind } : {}),
      ...(source ? { source } : {}),
    }),
  });

  await deliverWebhooks(env, projectId, "message.created", {
    roomId,
    messageId,
    userId,
    content,
    createdAt: createdAtIso,
    ...(clientMessageId ? { clientMessageId } : {}),
    ...(source ? { source } : {}),
  }).catch(() => {});

  void maybeSyncMatrixOutboundForMessage(env, {
    projectId,
    roomId,
    messageId,
    content,
  }).catch(() => {});
}

/**
 * Push a typed server_event to connected room clients (game ticks, IoT readings, live stats).
 */
export async function fanoutServerEvent(
  env,
  { projectId, roomId, name, data, userId },
) {
  if (!roomId) return;
  await fanoutRoomInternal(env, projectId, roomId, "/announce", {
    method: "POST",
    body: JSON.stringify({
      type: "server_event",
      roomId,
      name,
      data: data ?? {},
      userId: userId ?? "system",
    }),
  });
}
