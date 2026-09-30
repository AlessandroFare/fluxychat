/**
 * Reviewer-fatigue snapshot for a tenant. Counts, not a product score.
 */
export async function loadHitlFatigueMetrics(env, projectId) {
  if (!env?.DB || !projectId) {
    return { pending: 0, decidedLast24h: 0, uniqueCurrentApprovers: 0 };
  }
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const row = await env.DB.prepare(
    `SELECT
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN decided_at IS NOT NULL AND decided_at >= ? THEN 1 ELSE 0 END) AS decided_24h,
        COUNT(DISTINCT CASE WHEN status = 'pending' THEN current_approver_id END) AS unique_approvers
      FROM hitl_approval_requests
      WHERE project_id = ?`,
  )
    .bind(since, projectId)
    .first();
  return {
    pending: Number(row?.pending || 0),
    decidedLast24h: Number(row?.decided_24h || 0),
    uniqueCurrentApprovers: Number(row?.unique_approvers || 0),
  };
}
