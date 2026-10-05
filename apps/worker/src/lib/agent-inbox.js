/**
 * Agent Inbox interrupts. Ambient agents pause here; humans accept / edit / reply / ignore.
 * LangGraph-shaped payloads are accepted so existing graphs can land on the same queue.
 */

export const AGENT_INTERRUPT_KINDS = ["notify", "question", "review"];
export const AGENT_INTERRUPT_ACTIONS = ["accept", "edit", "reply", "ignore"];

export function mapLangGraphInterrupt(payload) {
  if (!payload || typeof payload !== "object") return { ok: false, error: "invalid_interrupt" };
  const value = payload.value && typeof payload.value === "object" ? payload.value : payload;
  const kindRaw = String(value.kind || value.type || payload.type || "question").toLowerCase();
  const kind =
    kindRaw === "notify" || kindRaw === "notification"
      ? "notify"
      : kindRaw === "review" || kindRaw === "approve"
        ? "review"
        : "question";
  const prompt = String(value.prompt || value.question || value.message || "").trim();
  if (!prompt) return { ok: false, error: "prompt_required" };
  return {
    ok: true,
    interrupt: {
      kind,
      prompt: prompt.slice(0, 4000),
      resumeValue: value.default != null ? value.default : null,
      graphNs: typeof payload.ns === "string" ? payload.ns.slice(0, 128) : null,
      runId: typeof value.runId === "string" ? value.runId.slice(0, 128) : null,
    },
  };
}

export function askHumanToolOpenAi() {
  return {
    type: "function",
    function: {
      name: "askHuman",
      description:
        "Pause the run and put a question on Agent Inbox. A human must accept, reply, or ignore. Not an HTTP tool.",
      parameters: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "What the human should answer" },
          kind: { type: "string", enum: ["notify", "question", "review"] },
        },
        required: ["prompt"],
      },
    },
  };
}

export function withAskHumanTool(tools) {
  const def = askHumanToolOpenAi();
  const list = Array.isArray(tools) ? tools.slice() : [];
  if (
    list.some((entry) => {
      const name = entry?.function?.name || entry?.name;
      return String(name || "").toLowerCase() === "askhuman";
    })
  ) {
    return list;
  }
  list.push(def);
  return list;
}

export function askHumanTool(input) {
  const mapped = mapLangGraphInterrupt({
    type: "interrupt",
    value: {
      kind: input?.kind || "question",
      prompt: input?.prompt || input?.question,
      runId: input?.runId,
    },
  });
  if (!mapped.ok) return mapped;
  return {
    ok: true,
    pause: true,
    toolName: "askHuman",
    interrupt: mapped.interrupt,
  };
}

export function applyAgentInboxAction(item, action, extra = {}) {
  if (!item || item.status !== "pending") return { ok: false, error: "not_pending" };
  if (!AGENT_INTERRUPT_ACTIONS.includes(action)) return { ok: false, error: "unknown_action" };
  const now = extra.now || new Date().toISOString();
  if (action === "ignore") return { ok: true, status: "ignored", resume: null, decidedAt: now };
  if (action === "accept") return { ok: true, status: "accepted", resume: item.interrupt.resumeValue ?? true, decidedAt: now };
  if (action === "edit") {
    const edited = String(extra.edited || "").trim().slice(0, 4000);
    if (!edited) return { ok: false, error: "edit_required" };
    return { ok: true, status: "edited", resume: edited, decidedAt: now };
  }
  const reply = String(extra.reply || "").trim().slice(0, 4000);
  if (!reply) return { ok: false, error: "reply_required" };
  return { ok: true, status: "replied", resume: reply, decidedAt: now };
}

export function hitlRowToInboxItem(entry) {
  if (!entry) return null;
  return {
    id: entry.id,
    roomId: entry.roomId,
    kind: "review",
    status: entry.status === "pending" ? "pending" : entry.status,
    priority: 2,
    summary: entry.reason || entry.toolName || "Approval",
    dueAt: entry.expiresAt || null,
    snoozeUntil: null,
    createdAt: entry.startedAt || entry.createdAt,
    interrupt: {
      kind: "review",
      prompt: entry.reason || `Tool ${entry.toolName} needs a human`,
      runId: entry.runId,
      resumeValue: null,
    },
  };
}

export function rankAgentInboxItems(items, nowMs = Date.now()) {
  const list = Array.isArray(items) ? [...items] : [];
  return list.sort((a, b) => {
    const pa = Number(a.priority) || 0;
    const pb = Number(b.priority) || 0;
    if (pb !== pa) return pb - pa;
    const da = a.dueAt ? Date.parse(a.dueAt) : Number.POSITIVE_INFINITY;
    const db = b.dueAt ? Date.parse(b.dueAt) : Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
  }).map((row) => {
    const snoozeUntil = row.snoozeUntil ? Date.parse(row.snoozeUntil) : 0;
    return { ...row, snoozed: Number.isFinite(snoozeUntil) && snoozeUntil > nowMs };
  });
}
