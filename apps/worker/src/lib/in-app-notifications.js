/**
 * Persist in-app notification rows (mention, dm, etc.).
 */
import { shouldBatchNotification } from "./quiet-hours.js";
import { enqueueBatchedNotification } from "./notification-batch.js";

export async function insertInAppNotificationDirect(
  env,
  {
    projectId,
    userId,
    kind,
    title,
    body = null,
    roomId = null,
    messageId = null,
  },
) {
  if (!env?.DB || !projectId || !userId || !kind || !title) return null;
  const now = new Date().toISOString();
  const insert = await env.DB.prepare(
    `INSERT INTO in_app_notifications (
      project_id, user_id, kind, title, body, room_id, message_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      projectId,
      userId,
      kind,
      title,
      body,
      roomId,
      messageId,
      now,
    )
    .run();
  return insert.meta?.last_row_id ?? null;
}

export async function createInAppNotification(
  env,
  input,
) {
  if (
    input?.projectId &&
    input?.userId &&
    (await shouldBatchNotification(env, input.projectId, input.userId, "in_app"))
  ) {
    await enqueueBatchedNotification(env, {
      projectId: input.projectId,
      userId: input.userId,
      channel: "in_app",
      kind: input.kind,
      title: input.title,
      body: input.body,
      roomId: input.roomId,
      messageId: input.messageId,
    });
    return null;
  }
  return insertInAppNotificationDirect(env, input);
}

export async function notifyMentionedUsers(
  env,
  { projectId, roomId, fromUserId, toUserIds, messageId, preview },
) {
  if (!Array.isArray(toUserIds) || !toUserIds.length) return;
  const snippet =
    typeof preview === "string" && preview.length
      ? preview.slice(0, 120)
      : "You were mentioned in a message.";
  await Promise.all(
    toUserIds
      .filter((uid) => uid && uid !== fromUserId)
      .map((userId) =>
        createInAppNotification(env, {
          projectId,
          userId,
          kind: "mention",
          title: "New mention",
          body: snippet,
          roomId,
          messageId,
        }),
      ),
  );
}

export async function notifyDmRecipient(
  env,
  { projectId, roomId, fromUserId, messageId, preview },
) {
  const members = await env.DB.prepare(
    "SELECT user_id FROM room_members WHERE project_id = ? AND room_id = ?",
  )
    .bind(projectId, roomId)
    .all();
  const recipients = (members.results || [])
    .map((r) => r.user_id)
    .filter((uid) => uid && uid !== fromUserId);
  if (!recipients.length) return;
  const snippet =
    typeof preview === "string" && preview.length
      ? preview.slice(0, 120)
      : "New direct message.";
  await Promise.all(
    recipients.map((userId) =>
      createInAppNotification(env, {
        projectId,
        userId,
        kind: "dm",
        title: "New message",
        body: snippet,
        roomId,
        messageId,
      }),
    ),
  );
}

/** NW-131 — Fan-out in-app notifications for announcement channel posts. */
export async function notifyAnnouncementMembers(
  env,
  { projectId, roomId, fromUserId, messageId, preview, roomName },
) {
  const members = await env.DB.prepare(
    `SELECT user_id FROM room_members WHERE project_id = ? AND room_id = ?`,
  )
    .bind(projectId, roomId)
    .all();
  const recipients = (members.results || [])
    .map((r) => r.user_id)
    .filter((uid) => uid && uid !== fromUserId);
  if (!recipients.length) return;

  const title = roomName ? `Announcement: ${roomName}` : "New announcement";
  const snippet =
    typeof preview === "string" && preview.length
      ? preview.slice(0, 120)
      : "A new announcement was posted.";

  await Promise.all(
    recipients.map((userId) =>
      createInAppNotification(env, {
        projectId,
        userId,
        kind: "announcement",
        title,
        body: snippet,
        roomId,
        messageId,
      }),
    ),
  );
}
