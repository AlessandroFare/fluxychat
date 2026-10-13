const COLLEAGUES = [
  {
    userId: "maya-bot",
    content:
      "[bot · Maya · ops] Queue looks busy. FluxyBot wants to run refund_order on order #1042 (240 €).",
  },
  {
    userId: "jules-bot",
    content:
      "[bot · Jules · support] I can take the customer if we reject. Your call on the refund.",
  },
];

/**
 * Real D1 rows for the public demo: two labeled bot colleagues + a pending HITL refund.
 * Idempotent. Failures are swallowed so session mint still works.
 */
export async function ensureDemoSceneExtras(env, { projectId, roomId, agentId, guestUserId }) {
  if (!env?.DB || !projectId || !roomId) return { ok: false };

  const now = new Date().toISOString();
  for (const bot of COLLEAGUES) {
    try {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS c FROM messages WHERE project_id = ? AND room_id = ? AND user_id = ? AND deleted_at IS NULL`,
      )
        .bind(projectId, roomId, bot.userId)
        .first();
      if (Number(row?.c) > 0) continue;
      await env.DB.prepare(
        `INSERT INTO messages (project_id, room_id, user_id, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      )
        .bind(projectId, roomId, bot.userId, bot.content, now)
        .run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO room_members (room_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
      )
        .bind(roomId, bot.userId, now)
        .run();
    } catch {
      // schema may lag
    }
  }

  try {
    const { createD1ApprovalStore } = await import("./hitl-approval-d1.js");
    const store = createD1ApprovalStore(env);
    const pending = await store.getPendingForRoom(projectId, roomId);
    const hasRefund = Array.isArray(pending) && pending.some((row) => row.toolName === "refund_order");
    if (!hasRefund) {
      await store.create({
        projectId,
        roomId,
        toolName: "refund_order",
        toolInput: { orderId: "1042", amountEur: 240 },
        userId: agentId || "fluxybot",
        agentId: agentId || null,
        approvalChainSnapshot: {
          steps: [{ approverId: guestUserId || "demo-guest" }],
          defaultTimeoutSeconds: 3600,
        },
      });
    }
  } catch {
    // HITL table may be missing on old local D1
  }

  if (agentId) {
    try {
      const { mergeRefundOrderAgentFields } = await import("./demo-refund-tool.js");
      const bot = await env.DB.prepare(
        "SELECT config, tools_schema FROM bots WHERE id = ? AND project_id = ? LIMIT 1",
      )
        .bind(agentId, projectId)
        .first();
      if (bot) {
        const merged = mergeRefundOrderAgentFields(bot.config, bot.tools_schema);
        await env.DB.prepare(
          "UPDATE bots SET config = ?, tools_schema = ? WHERE id = ? AND project_id = ?",
        )
          .bind(JSON.stringify(merged.config), JSON.stringify(merged.toolsSchema), agentId, projectId)
          .run();
      }
    } catch {
      // bot row may be missing
    }
  }

  return { ok: true };
}
