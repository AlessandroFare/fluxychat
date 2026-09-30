import { MAX_MESSAGE_LENGTH } from "./message-validation.js";

export const MAX_IMPORT_MESSAGES = 400;

function toIso(value) {
  if (value == null || value === "") return new Date().toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function clipContent(text) {
  return String(text || "")
    .trim()
    .slice(0, MAX_MESSAGE_LENGTH);
}

function textFromGptMessage(message) {
  const parts = message?.content?.parts;
  if (Array.isArray(parts)) {
    return parts
      .filter((part) => typeof part === "string")
      .join("\n")
      .trim();
  }
  if (typeof message?.content === "string") return message.content.trim();
  if (typeof message?.content?.text === "string") return message.content.text.trim();
  return "";
}

function flattenChatGptConversation(conv) {
  const mapping = conv?.mapping && typeof conv.mapping === "object" ? conv.mapping : {};
  const out = [];
  for (const node of Object.values(mapping)) {
    const msg = node?.message;
    if (!msg) continue;
    const role = msg.author?.role;
    if (role !== "user" && role !== "assistant") continue;
    const text = clipContent(textFromGptMessage(msg));
    if (!text) continue;
    out.push({
      role,
      content: text,
      createdAt: toIso(msg.create_time ?? conv.create_time),
    });
  }
  out.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  return {
    title: String(conv.title || "Imported chat").slice(0, 80) || "Imported chat",
    messages: out,
  };
}

function flattenClaudeChat(raw) {
  const rows = raw?.chat_messages || raw?.messages;
  if (!Array.isArray(rows)) return null;
  const messages = [];
  for (const row of rows) {
    const sender = String(row.sender || row.role || "").toLowerCase();
    const role =
      sender === "human" || sender === "user"
        ? "user"
        : sender === "assistant"
          ? "assistant"
          : null;
    if (!role) continue;
    const text = clipContent(row.text || row.content || row.message);
    if (!text) continue;
    messages.push({
      role,
      content: text,
      createdAt: toIso(row.created_at || row.createdAt),
    });
  }
  if (!messages.length) return null;
  return {
    title: String(raw.name || raw.title || "Imported chat").slice(0, 80),
    messages,
  };
}

function flattenGeneric(raw) {
  const rows = raw?.messages;
  if (!Array.isArray(rows)) return null;
  const messages = [];
  for (const row of rows) {
    const roleRaw = String(row.role || "").toLowerCase();
    const role = roleRaw === "assistant" || roleRaw === "ai" ? "assistant" : roleRaw === "user" ? "user" : null;
    if (!role) continue;
    const text = clipContent(row.content || row.text);
    if (!text) continue;
    messages.push({
      role,
      content: text,
      createdAt: toIso(row.createdAt || row.created_at || row.timestamp),
    });
  }
  if (!messages.length) return null;
  return {
    title: String(raw.title || raw.name || "Imported chat").slice(0, 80),
    messages,
  };
}

/**
 * Parse a user-supplied ChatGPT / Claude / simple JSON export. No fetching.
 * @param {unknown} payload
 */
export function parseTranscriptExport(payload) {
  if (payload == null) return { ok: false, error: "empty_export" };

  if (Array.isArray(payload)) {
    for (const conv of payload) {
      const flat = flattenChatGptConversation(conv);
      if (flat.messages.length) {
        return {
          ok: true,
          source: "chatgpt",
          title: flat.title,
          messages: flat.messages.slice(0, MAX_IMPORT_MESSAGES),
          truncated: flat.messages.length > MAX_IMPORT_MESSAGES,
          extraConversations: Math.max(0, payload.length - 1),
        };
      }
    }
    return { ok: false, error: "no_messages" };
  }

  if (typeof payload !== "object") return { ok: false, error: "invalid_export" };

  const claude = flattenClaudeChat(payload);
  if (claude) {
    return {
      ok: true,
      source: "claude",
      title: claude.title,
      messages: claude.messages.slice(0, MAX_IMPORT_MESSAGES),
      truncated: claude.messages.length > MAX_IMPORT_MESSAGES,
      extraConversations: 0,
    };
  }

  if (Array.isArray(payload.conversations) && payload.conversations[0]) {
    return parseTranscriptExport(payload.conversations);
  }

  const gpt = flattenChatGptConversation(payload);
  if (gpt.messages.length) {
    return {
      ok: true,
      source: "chatgpt",
      title: gpt.title,
      messages: gpt.messages.slice(0, MAX_IMPORT_MESSAGES),
      truncated: gpt.messages.length > MAX_IMPORT_MESSAGES,
      extraConversations: 0,
    };
  }

  const generic = flattenGeneric(payload);
  if (generic) {
    return {
      ok: true,
      source: "generic",
      title: generic.title,
      messages: generic.messages.slice(0, MAX_IMPORT_MESSAGES),
      truncated: generic.messages.length > MAX_IMPORT_MESSAGES,
      extraConversations: 0,
    };
  }

  return { ok: false, error: "no_messages" };
}

async function insertImportedRow(env, { projectId, roomId, userId, content, createdAt, role }) {
  const withMeta = `INSERT INTO messages (
      project_id, room_id, user_id, content, created_at, parent_id,
      mentions, og_title, og_description, og_image, og_url,
      participant_type, metadata_json
    ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?)`;
  const metadata = JSON.stringify({
    imported: true,
    trust: "unverified",
    source: "transcript_export",
    role: role === "assistant" ? "assistant" : "user",
  });
  try {
    await env.DB.prepare(withMeta)
      .bind(projectId, roomId, userId, content, createdAt, "human", metadata)
      .run();
  } catch {
    await env.DB.prepare(
      `INSERT INTO messages (project_id, room_id, user_id, content, created_at, parent_id)
       VALUES (?, ?, ?, ?, ?, NULL)`,
    )
      .bind(projectId, roomId, userId, content, createdAt)
      .run();
  }
}

/**
 * Create a group room and insert parsed messages. Inviter is owner.
 */
export async function importTranscriptToNewRoom(env, {
  projectId,
  ownerUserId,
  parsed,
  roomName,
  inviteUserIds,
  isValidId,
  validateRoomName,
}) {
  const nameCheck = validateRoomName(roomName || parsed.title || "Imported chat");
  if (!nameCheck.valid) return { ok: false, error: nameCheck.error };

  const now = new Date().toISOString();
  const roomId = crypto.randomUUID();
  await env.DB.prepare(
    "INSERT INTO rooms (id, project_id, type, name, created_at) VALUES (?, ?, 'group', ?, ?)",
  )
    .bind(roomId, projectId, nameCheck.name, now)
    .run();

  const memberIds = new Set([ownerUserId]);
  for (const id of inviteUserIds || []) {
    if (isValidId(id) && memberIds.size < 21) memberIds.add(id);
  }
  const memberStmts = [...memberIds].map((userId, index) =>
    env.DB.prepare(
      "INSERT INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)",
    ).bind(roomId, userId, index === 0 || userId === ownerUserId ? "owner" : "member", now),
  );
  if (memberStmts.length) await env.DB.batch(memberStmts);

  const assistantUserId = "import_assistant";
  let inserted = 0;
  for (const msg of parsed.messages) {
    const userId = msg.role === "assistant" ? assistantUserId : ownerUserId;
    await insertImportedRow(env, {
      projectId,
      roomId,
      userId,
      content: msg.content,
      createdAt: msg.createdAt,
      role: msg.role,
    });
    inserted += 1;
  }

  return {
    ok: true,
    roomId,
    roomName: nameCheck.name,
    inserted,
    source: parsed.source,
    truncated: Boolean(parsed.truncated),
    extraConversations: parsed.extraConversations || 0,
  };
}
