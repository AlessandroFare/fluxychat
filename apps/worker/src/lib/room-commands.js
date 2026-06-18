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

const BUILT_IN_COMMANDS = [
  { command: "/help", description: "Show available commands", usage: "/help", handler: "help", required_role: "member" },
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
      return { ok: true, action: "clear", message: "Draft cleared." };
    default:
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

function hasRequiredRole(userRole, required) {
  const hierarchy = { owner: 5, admin: 4, mod: 3, member: 2, guest: 1 };
  return (hierarchy[userRole] || 0) >= (hierarchy[required] || 0);
}

