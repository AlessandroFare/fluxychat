/** Canonical wrap-up codes for agent queue resolve (P13-T5). */

export const AGENT_DISPOSITIONS = [
  { code: "resolved", label: "Resolved" },
  { code: "answered", label: "Answered / FAQ" },
  { code: "escalated", label: "Escalated to engineering" },
  { code: "spam", label: "Spam / abuse" },
  { code: "no_response", label: "No response needed" },
  { code: "duplicate", label: "Duplicate thread" },
  { code: "other", label: "Other" },
];

const CODE_SET = new Set(AGENT_DISPOSITIONS.map((d) => d.code));

/**
 * @param {string | null | undefined} raw
 * @param {{ required?: boolean }} [opts]
 */
export function normalizeAgentDisposition(raw, opts = {}) {
  const code = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (!code) {
    if (opts.required) return { ok: false, error: "disposition_required" };
    return { ok: true, code: null };
  }
  if (!CODE_SET.has(code)) {
    return { ok: false, error: "invalid_disposition" };
  }
  return { ok: true, code };
}

export function listAgentDispositions() {
  return AGENT_DISPOSITIONS.map((d) => ({ ...d }));
}

/**
 * @param {*} env
 * @param {string} projectId
 */
export async function getAgentDispositionStats(env, projectId) {
  const rows = await env.DB.prepare(
    `SELECT disposition, COUNT(*) AS count
     FROM agent_tasks
     WHERE project_id = ? AND status = 'resolved' AND disposition IS NOT NULL
     GROUP BY disposition
     ORDER BY count DESC`,
  )
    .bind(projectId)
    .all();

  const byCode = new Map(
    (rows.results || []).map((r) => [r.disposition, Number(r.count) || 0]),
  );
  const breakdown = AGENT_DISPOSITIONS.map((d) => ({
    code: d.code,
    label: d.label,
    count: byCode.get(d.code) ?? 0,
  })).filter((row) => row.count > 0);

  const unknown = [...byCode.entries()]
    .filter(([code]) => !CODE_SET.has(code))
    .map(([code, count]) => ({ code, count }));

  return {
    total: breakdown.reduce((sum, r) => sum + r.count, 0) + unknown.reduce((s, r) => s + r.count, 0),
    breakdown,
    unknown,
  };
}
