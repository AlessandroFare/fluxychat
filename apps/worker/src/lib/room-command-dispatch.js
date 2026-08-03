/**
 * #60 Slash command dispatch — intercept outbound messages, execute handlers, fan out results.
 */
import { parseCommand, executeCommand, resolveHighestRole } from "./room-commands.js";
import { getRoomMemberRole } from "./message-decisions.js";
import { insertMessagePoll } from "./message-polls.js";
import { fanoutRoomInternal } from "./room-shard.js";

/**
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   content: string,
 *   jwtRoles?: string[],
 *   parentId?: number | null,
 *   clientMessageId?: string | null,
 * }} input
 */
export async function tryDispatchSlashCommand(env, input) {
  const parsed = parseCommand(input.content);
  if (!parsed) return { handled: false };

  if (parsed.command === "/clear") {
    return {
      handled: true,
      ok: true,
      suppressMessage: true,
      commandResult: { ok: true, action: "clear", message: "Draft cleared." },
    };
  }

  const memberRole = await getRoomMemberRole(
    env,
    input.roomId,
    input.userId,
    input.jwtRoles ?? [],
  );
  const userRole = resolveHighestRole([memberRole, ...(input.jwtRoles ?? [])]);

  const result = await executeCommand(env, {
    projectId: input.projectId,
    roomId: input.roomId,
    userId: input.userId,
    userRole,
    command: parsed.command,
    args: parsed.args,
    rawArgs: parsed.rawArgs,
  });

  if (!result.ok) {
    return {
      handled: true,
      ok: false,
      status: result.status || 400,
      error: result.error,
      commandResult: result,
    };
  }

  if (result.suppressMessage) {
    return { handled: true, ok: true, suppressMessage: true, commandResult: result };
  }

  const createdAt = new Date().toISOString();
  let messageId = null;
  let pollSnapshot = null;
  let content = result.message || `⚡ ${parsed.command} executed`;

  if (result.action === "poll" && result.pollCreate?.ok) {
    content = result.pollCreate.question;
    const insertRes = await env.DB.prepare(
      `INSERT INTO messages (
        project_id, room_id, user_id, content, created_at, parent_id,
        mentions, og_title, og_description, og_image, og_url, client_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?)`,
    )
      .bind(
        input.projectId,
        input.roomId,
        input.userId,
        content,
        createdAt,
        input.parentId ?? null,
        input.clientMessageId ?? null,
      )
      .run();
    messageId = insertRes.meta.last_row_id;
    pollSnapshot = await insertMessagePoll(env, {
      messageId,
      projectId: input.projectId,
      roomId: input.roomId,
      question: result.pollCreate.question,
      options: result.pollCreate.options,
      allowMultiple: result.pollCreate.allowMultiple,
    });
  } else if (result.postMessage !== false && result.message) {
    const insertRes = await env.DB.prepare(
      `INSERT INTO messages (
        project_id, room_id, user_id, content, created_at, parent_id,
        mentions, og_title, og_description, og_image, og_url, client_message_id
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, ?)`,
    )
      .bind(
        input.projectId,
        input.roomId,
        input.userId,
        content,
        createdAt,
        input.parentId ?? null,
        input.clientMessageId ?? null,
      )
      .run();
    messageId = insertRes.meta.last_row_id;
  }

  if (messageId) {
    await fanoutRoomInternal(env, input.projectId, input.roomId, "/announce", {
      method: "POST",
      body: JSON.stringify({
        roomId: input.roomId,
        id: messageId,
        content,
        userId: input.userId,
        senderId: input.userId,
        createdAt,
        parentId: input.parentId ?? null,
        ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
        ...(pollSnapshot ? { poll: pollSnapshot, contentType: "poll" } : {}),
      }),
    });
  }

  return {
    handled: true,
    ok: true,
    commandResult: result,
    message: messageId
      ? {
          id: messageId,
          roomId: input.roomId,
          userId: input.userId,
          senderId: input.userId,
          content,
          createdAt,
          parentId: input.parentId ?? null,
          ...(pollSnapshot ? { poll: pollSnapshot, contentType: "poll" } : {}),
          ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
        }
      : null,
  };
}
