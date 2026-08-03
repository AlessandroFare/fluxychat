/**
 * P19-J: Command Palette for Room.
 *
 * Slash commands for power users.
 * Features:
 *   • Built-in commands: /mute, /unmute, /pin, /unpin, /escalate, /summarize, /broadcast, /export, /help, /members, /info, /clear
 *   • Custom command registration
 *   • Command parsing with arguments
 *   • Role-based access control
 *   • Autocomplete suggestions
 */

import { parsePollCreateInput } from "./message-polls.js";

const BUILT_IN_COMMANDS = [
  { command: "/help", description: "Show available commands", usage: "/help", handler: "help", required_role: "member" },
  { command: "/poll", description: "Create a quick poll", usage: '/poll Question? | Option A | Option B', handler: "poll", required_role: "member" },
  { command: "/remind", description: "Schedule a reminder message", usage: "/remind 30m Your reminder text", handler: "remind", required_role: "member" },
  { command: "/assign", description: "Assign a task to a teammate", usage: "/assign @user Task description", handler: "assign", required_role: "member" },
  { command: "/mute", description: "Mute a user in this room", usage: "/mute @username [reason]", handler: "mute", required_role: "mod" },
  { command: "/unmute", description: "Unmute a user", usage: "/unmute @username", handler: "unmute", required_role: "mod" },
  { command: "/pin", description: "Pin the last message or a specific message", usage: "/pin [messageId]", handler: "pin", required_role: "mod" },
  { command: "/unpin", description: "Unpin a pinned message", usage: "/unpin [messageId]", handler: "unpin", required_role: "mod" },
  { command: "/escalate", description: "Escalate this conversation to a human agent", usage: "/escalate [reason]", handler: "escalate", required_role: "member" },
  { command: "/summarize", description: "Get an AI summary of recent messages", usage: "/summarize [count]", handler: "summarize", required_role: "member" },
  { command: "/broadcast", description: "Send a broadcast message to all room members", usage: "/broadcast <message>", handler: "broadcast", required_role: "admin" },
  { command: "/export", description: "Export room history", usage: "/export [format]", handler: "export", required_role: "admin" },
  { command: "/members", description: "List room members", usage: "/members", handler: "members", required_role: "member" },
  { command: "/info", description: "Show room information", usage: "/info", handler: "info", required_role: "member" },
  { command: "/clear", description: "Clear your draft message", usage: "/clear", handler: "clear", required_role: "member" },
];

const ROLE_HIERARCHY = { owner: 5, admin: 4, mod: 3, moderator: 3, member: 2, guest: 1, bot: 2 };

/**
 * Resolve the highest-privilege role from JWT / room membership roles.
 * @param {string[]} roles
 */
export function resolveHighestRole(roles) {
  if (!Array.isArray(roles) || roles.length === 0) return "member";
  let best = "guest";
  let bestScore = 0;
  for (const raw of roles) {
    const role = String(raw || "").toLowerCase();
    const normalized = role === "moderator" ? "mod" : role;
    const score = ROLE_HIERARCHY[role] ?? ROLE_HIERARCHY[normalized] ?? 0;
    if (score > bestScore) {
      bestScore = score;
      best = normalized;
    }
  }
  return best;
}

/**
 * Parse a slash command from message content.
 */
export function parseCommand(content) {
  if (!content || typeof content !== "string") return null;
  const trimmed = content.trim();
  if (!trimmed.startsWith("/")) return null;

  const parts = trimmed.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1);
  const rawArgs = trimmed.slice(command.length).trim();

  return { command, args, rawArgs };
}

/**
 * Get all available commands for a project (built-in + custom).
 */
export async function listCommands(env, { projectId }) {
  let custom = [];
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM room_commands WHERE project_id = ? AND enabled = 1`
    ).bind(projectId).all();
    custom = results || [];
  } catch (_) { /* table may not exist */ }

  return [...BUILT_IN_COMMANDS, ...custom];
}

/**
 * Get autocomplete suggestions for a partial command.
 */
export async function getAutocompleteSuggestions(env, { projectId, partial }) {
  const commands = await listCommands(env, { projectId });
  const lower = (partial || "").toLowerCase();
  return commands
    .filter(c => c.command.startsWith(lower) || c.description.toLowerCase().includes(lower))
    .slice(0, 10)
    .map(c => ({
      command: c.command,
      description: c.description,
      usage: c.usage,
    }));
}

/**
 * Execute a parsed command.
 */
export async function executeCommand(env, {
  projectId, roomId, userId, userRole, command, args, rawArgs,
}) {
  const commands = await listCommands(env, { projectId });
  const cmd = commands.find(c => c.command === command);
  if (!cmd) {
    return { ok: false, error: `Unknown command: ${command}. Type /help for available commands.`, status: 400 };
  }

  // Role check
  if (!hasRequiredRole(userRole, cmd.required_role)) {
    return { ok: false, error: `Insufficient permissions. Required: ${cmd.required_role}`, status: 403 };
  }

  // Route to handler
  switch (cmd.handler) {
    case "help":
      return handleHelp(commands);
    case "mute":
      return handleMute(env, { projectId, roomId, args, userId });
    case "unmute":
      return handleUnmute(env, { projectId, roomId, args, userId });
    case "pin":
      return handlePin(env, { projectId, roomId, args, userId });
    case "unpin":
      return handleUnpin(env, { projectId, roomId, args, userId });
    case "escalate":
      return handleEscalate(env, { projectId, roomId, userId, rawArgs });
    case "summarize":
      return handleSummarize(env, { projectId, roomId, args });
    case "broadcast":
      return handleBroadcast(env, { projectId, roomId, userId, rawArgs });
    case "export":
      return handleExport(env, { projectId, roomId, args });
    case "members":
      return handleMembers(env, { projectId, roomId });
    case "info":
      return handleInfo(env, { projectId, roomId });
    case "clear":
      return { ok: true, action: "clear", message: "Draft cleared.", suppressMessage: true };
    case "poll":
      return handlePoll({ args, rawArgs });
    case "remind":
      return handleRemind(env, { projectId, roomId, userId, args, rawArgs });
    case "assign":
      return handleAssign(env, { projectId, roomId, userId, args, rawArgs });
    case "custom":
    case "echo":
      return handleCustomEcho({ rawArgs, cmd });
    default:
      if (cmd.project_id) {
        return handleCustomEcho({ rawArgs, cmd });
      }
      return { ok: false, error: `Handler not implemented: ${cmd.handler}`, status: 500 };
  }
}

// --- Handlers ---

function handleHelp(commands) {
  const lines = commands.map(c => `**${c.command}** — ${c.description}\n  Usage: \`${c.usage}\``);
  return { ok: true, action: "help", message: lines.join("\n\n"), commands };
}

async function handleMute(env, { projectId, roomId, args, userId }) {
  const target = args[0]?.replace("@", "");
  if (!target) return { ok: false, error: "Usage: /mute @username [reason]", status: 400 };
  const reason = args.slice(1).join(" ") || "muted by command";
  // Record in audit
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'command.mute', ?, ?)`
    ).bind(projectId, userId, JSON.stringify({ roomId, target, reason })).run();
  } catch (_) { /* non-critical */ }
  return { ok: true, action: "mute", target, reason, message: `Muted @${target}: ${reason}` };
}

async function handleUnmute(env, { projectId, roomId, args, userId }) {
  const target = args[0]?.replace("@", "");
  if (!target) return { ok: false, error: "Usage: /unmute @username", status: 400 };
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'command.unmute', ?, ?)`
    ).bind(projectId, userId, JSON.stringify({ roomId, target })).run();
  } catch (_) { /* non-critical */ }
  return { ok: true, action: "unmute", target, message: `Unmuted @${target}` };
}

async function handlePin(env, { projectId, roomId, args, userId }) {
  const messageId = args[0] || null;
  return { ok: true, action: "pin", messageId, message: messageId ? `Pinned message ${messageId}` : "Pin the last message (use message ID)" };
}

async function handleUnpin(env, { projectId, roomId, args, userId }) {
  const messageId = args[0] || null;
  return { ok: true, action: "unpin", messageId, message: messageId ? `Unpinned message ${messageId}` : "Provide a message ID to unpin" };
}

async function handleEscalate(env, { projectId, roomId, userId, rawArgs }) {
  const reason = rawArgs || "escalated via command";
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'command.escalate', ?, ?)`
    ).bind(projectId, userId, JSON.stringify({ roomId, reason })).run();
  } catch (_) { /* non-critical */ }
  return { ok: true, action: "escalate", reason, message: `Escalated: ${reason}` };
}

async function handleSummarize(env, { projectId, roomId, args }) {
  const count = parseInt(args[0] || "20", 10);
  return { ok: true, action: "summarize", count, message: `Summarizing last ${count} messages...` };
}

async function handleBroadcast(env, { projectId, roomId, userId, rawArgs }) {
  if (!rawArgs) return { ok: false, error: "Usage: /broadcast <message>", status: 400 };
  return { ok: true, action: "broadcast", text: rawArgs, message: `Broadcast sent: ${rawArgs}` };
}

async function handleExport(env, { projectId, roomId, args }) {
  const format = args[0] || "markdown";
  return { ok: true, action: "export", format, message: `Exporting room as ${format}...` };
}

async function handleMembers(env, { projectId, roomId }) {
  return { ok: true, action: "members", message: "Fetching member list..." };
}

async function handleInfo(env, { projectId, roomId }) {
  return { ok: true, action: "info", message: "Fetching room info..." };
}

function handlePoll({ args, rawArgs }) {
  const source = rawArgs || args.join(" ");
  const parts = source.includes("|")
    ? source.split("|").map((p) => p.trim()).filter(Boolean)
    : args.filter(Boolean);
  if (parts.length < 3) {
    return {
      ok: false,
      error: 'Usage: /poll Question? | Option A | Option B (min 2 options)',
      status: 400,
    };
  }
  const question = parts[0];
  const options = parts.slice(1);
  const pollCreate = parsePollCreateInput({ question, options });
  if (!pollCreate.ok) {
    return { ok: false, error: pollCreate.error, status: 400 };
  }
  return {
    ok: true,
    action: "poll",
    pollCreate,
    message: pollCreate.question,
    postMessage: true,
  };
}


async function handleRemind(env, { projectId, roomId, userId, args, rawArgs }) {
  const source = rawArgs || args.join(" ");
  const match = source.match(/^(\S+)\s+([\s\S]+)$/);
  if (!match) {
    return { ok: false, error: "Usage: /remind 30m Your reminder text", status: 400 };
  }
  const [, whenToken, reminderText] = match;
  const sendAt = parseRemindWhen(whenToken);
  if (!sendAt) {
    return {
      ok: false,
      error: "Invalid time. Use 30m, 2h, 1d, or ISO timestamp",
      status: 400,
    };
  }
  if (Date.parse(sendAt) <= Date.now()) {
    return { ok: false, error: "Reminder time must be in the future", status: 400 };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO scheduled_messages (project_id, room_id, user_id, content, send_at, status, parent_id, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?)`,
  )
    .bind(projectId, roomId, userId, reminderText.trim(), sendAt, now)
    .run();
  try {
    const id = env.ROOM.idFromName(roomId);
    await env.ROOM.get(id)
      .fetch("https://internal/schedule-expiry", { method: "POST" })
      .catch(() => {});
  } catch {
    /* non-critical */
  }
  return {
    ok: true,
    action: "remind",
    sendAt,
    message: `⚡ Reminder scheduled for ${sendAt}: ${reminderText.trim()}`,
  };
}

async function handleAssign(env, { projectId, roomId, userId, args, rawArgs }) {
  const source = rawArgs || args.join(" ");
  const match = source.match(/^@?(\S+)\s+([\s\S]+)$/);
  if (!match) {
    return { ok: false, error: "Usage: /assign @user Task description", status: 400 };
  }
  const [, assignee, taskText] = match;
  const now = new Date().toISOString();
  const content = `Assigned to @${assignee}: ${taskText.trim()}`;
  const memoryId = crypto.randomUUID();
  await env.DB.prepare(
    `INSERT INTO room_memory (id, project_id, room_id, kind, content, source_message_ids, confidence, created_at, updated_at)
     VALUES (?, ?, ?, 'task', ?, NULL, 0.9, ?, ?)`,
  )
    .bind(memoryId, projectId, roomId, content, now, now)
    .run();
  try {
    await env.DB.prepare(
      `INSERT INTO operational_audit_events (project_id, action, actor_user_id, details)
       VALUES (?, 'command.assign', ?, ?)`,
    )
      .bind(projectId, userId, JSON.stringify({ roomId, assignee, task: taskText.trim() })).run();
  } catch {
    /* non-critical */
  }
  return { ok: true, action: "assign", assignee, task: taskText.trim(), message: `⚡ ${content}` };
}

function handleCustomEcho({ rawArgs, cmd }) {
  let template = `/${String(cmd.command || "").replace(/^\//, "")} executed`;
  try {
    if (cmd.config_json) {
      const config = JSON.parse(cmd.config_json);
      if (typeof config.responseTemplate === "string" && config.responseTemplate.trim()) {
        template = config.responseTemplate;
      }
    }
  } catch {
    /* ignore bad config */
  }
  const message = template.replace(/\{args\}/g, rawArgs || "").trim();
  return { ok: true, action: "custom", message: `⚡ ${message}` };
}

/**
 * Parse /remind time token into ISO string.
 * @param {string} token
 */
function parseRemindWhen(token) {
  const lower = String(token || "").trim().toLowerCase();
  const rel = lower.match(/^(\d+)(m|h|d)$/);
  if (rel) {
    const amount = Number(rel[1]);
    const unit = rel[2];
    const ms =
      unit === "m" ? amount * 60_000 : unit === "h" ? amount * 3_600_000 : amount * 86_400_000;
    return new Date(Date.now() + ms).toISOString();
  }
  const parsed = Date.parse(token);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

function hasRequiredRole(userRole, required) {
  const normalized = userRole === "moderator" ? "mod" : userRole;
  const requiredNorm = required === "moderator" ? "mod" : required;
  return (ROLE_HIERARCHY[normalized] || 0) >= (ROLE_HIERARCHY[requiredNorm] || 0);
}

/**
 * List custom tenant commands (admin CRUD).
 */
export async function listCustomCommands(env, { projectId }) {
  try {
    const { results } = await env.DB.prepare(
      `SELECT * FROM room_commands WHERE project_id = ? ORDER BY command ASC`,
    )
      .bind(projectId)
      .all();
    return results || [];
  } catch {
    return [];
  }
}

/**
 * Create a tenant custom slash command.
 */
export async function createCustomCommand(env, { projectId, command, description, usage, handler, requiredRole, config }) {
  const normalized = command.startsWith("/") ? command.toLowerCase() : `/${command}`.toLowerCase();
  if (BUILT_IN_COMMANDS.some((c) => c.command === normalized)) {
    return { ok: false, error: "conflicts with built-in command", status: 409 };
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO room_commands (id, project_id, command, description, usage, handler, required_role, enabled, config_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    )
      .bind(
        id,
        projectId,
        normalized,
        description,
        usage || normalized,
        handler || "echo",
        requiredRole || "member",
        config ? JSON.stringify(config) : null,
        now,
        now,
      )
      .run();
  } catch (err) {
    if (String(err?.message || err).includes("UNIQUE")) {
      return { ok: false, error: "command already exists", status: 409 };
    }
    throw err;
  }
  return { ok: true, command: { id, projectId, command: normalized, description, usage, handler: handler || "echo", required_role: requiredRole || "member", enabled: 1, config_json: config ? JSON.stringify(config) : null } };
}

/**
 * Update tenant custom command.
 */
export async function updateCustomCommand(env, { projectId, commandId, patch }) {
  const existing = await env.DB.prepare(
    `SELECT * FROM room_commands WHERE id = ? AND project_id = ? LIMIT 1`,
  )
    .bind(commandId, projectId)
    .first();
  if (!existing) return { ok: false, error: "not found", status: 404 };

  const now = new Date().toISOString();
  const description = patch.description ?? existing.description;
  const usage = patch.usage ?? existing.usage;
  const handler = patch.handler ?? existing.handler;
  const requiredRole = patch.required_role ?? patch.requiredRole ?? existing.required_role;
  const enabled = patch.enabled ?? existing.enabled;
  const configJson =
    patch.config !== undefined
      ? JSON.stringify(patch.config)
      : patch.config_json ?? existing.config_json ?? null;

  await env.DB.prepare(
    `UPDATE room_commands
     SET description = ?, usage = ?, handler = ?, required_role = ?, enabled = ?, config_json = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`,
  )
    .bind(description, usage, handler, requiredRole, enabled ? 1 : 0, configJson, now, commandId, projectId)
    .run();

  return { ok: true };
}

/**
 * Delete tenant custom command.
 */
export async function deleteCustomCommand(env, { projectId, commandId }) {
  const result = await env.DB.prepare(
    `DELETE FROM room_commands WHERE id = ? AND project_id = ?`,
  )
    .bind(commandId, projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not found", status: 404 };
  return { ok: true };
}

