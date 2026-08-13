/**
 * Template marketplace — extends MCP audit with semver templates + badge expiry.
 */
import { getLatestMarketplaceAudit, auditGradeFromScore } from "./marketplace-audit.js";

/** Days without fresh audit after last commit → "Unmaintained" badge. */
export const UNMAINTAINED_AUDIT_STALE_DAYS = 90;

/** Days since last audit → audit badge expires. */
export const AUDIT_BADGE_EXPIRY_DAYS = 180;

const SEED_TEMPLATES = [
  {
    templateId: "hr-feedback",
    version: "1.0.0",
    name: "HR Anonymous Feedback",
    description: "Anonymous feedback with sensitive classification and HR escalation.",
    category: "compliance",
    repoUrl: "https://github.com/AlessandroFare/fluxychat/tree/main/packages/create-fluxy-chat/templates/hr-feedback",
  },
  {
    templateId: "react",
    version: "2.1.0",
    name: "React Chat Widget",
    description: "Embed-ready React chat with FluxyChat SDK.",
    category: "frontend",
    repoUrl: "https://github.com/AlessandroFare/fluxychat/tree/main/packages/create-fluxy-chat/templates/react",
  },
];

function nowIso() {
  return new Date().toISOString();
}

function daysBetween(fromMs, toMs) {
  return (toMs - fromMs) / (86400 * 1000);
}

/**
 * @param {{ lastAuditedAt?: number | null, lastCommitAt?: string | null, now?: number }} input
 */
export function computeTemplateBadge(input) {
  const now = input.now ?? Date.now();
  const lastAuditedAt = input.lastAuditedAt ?? null;
  const lastCommitAt = input.lastCommitAt ? Date.parse(input.lastCommitAt) : null;

  if (!lastAuditedAt) {
    return { badge: "Unverified", grade: null, expired: true };
  }

  const auditAgeDays = daysBetween(lastAuditedAt, now);
  if (auditAgeDays > AUDIT_BADGE_EXPIRY_DAYS) {
    return { badge: "AuditExpired", grade: null, expired: true };
  }

  if (lastCommitAt && lastCommitAt > lastAuditedAt) {
    const staleDays = daysBetween(lastAuditedAt, lastCommitAt);
    if (staleDays > UNMAINTAINED_AUDIT_STALE_DAYS) {
      return { badge: "Unmaintained", grade: null, expired: false };
    }
  }

  return { badge: "Verified", grade: null, expired: false };
}

/**
 * @param {*} env
 */
export async function ensureTemplateRegistrySeeded(env) {
  if (!env?.DB) return;
  const now = nowIso();
  for (const tpl of SEED_TEMPLATES) {
    await env.DB.prepare(
      `INSERT INTO template_registry
       (template_id, version, name, description, category, repo_url, last_commit_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(template_id, version) DO NOTHING`,
    )
      .bind(
        tpl.templateId,
        tpl.version,
        tpl.name,
        tpl.description,
        tpl.category,
        tpl.repoUrl,
        now,
        now,
        now,
      )
      .run();
  }
}

/**
 * @param {*} env
 * @param {{ category?: string, limit?: number }} [opts]
 */
export async function listTemplateMarketplace(env, opts = {}) {
  if (!env?.DB) return [];
  await ensureTemplateRegistrySeeded(env);

  const limit = Math.min(Math.max(Number(opts.limit) || 50, 1), 100);
  let sql = `SELECT template_id, version, name, description, category, repo_url, last_commit_at, last_audited_at
             FROM template_registry`;
  const binds = [];
  if (opts.category) {
    sql += ` WHERE category = ?`;
    binds.push(opts.category);
  }
  sql += ` ORDER BY updated_at DESC LIMIT ?`;
  binds.push(limit);

  const { results } = await env.DB.prepare(sql).bind(...binds).all();
  const now = Date.now();

  const enriched = [];
  for (const row of results || []) {
    const auditKey = `${row.template_id}@${row.version}`;
    const audit = await getLatestMarketplaceAudit(env.DB, auditKey);
    const lastAuditedAt = audit?.scannedAt ?? row.last_audited_at ?? null;

    if (audit?.scannedAt && !row.last_audited_at) {
      await env.DB.prepare(
        `UPDATE template_registry SET last_audited_at = ?, updated_at = ? WHERE template_id = ? AND version = ?`,
      )
        .bind(audit.scannedAt, nowIso(), row.template_id, row.version)
        .run();
    }

    const badge = computeTemplateBadge({
      lastAuditedAt,
      lastCommitAt: row.last_commit_at,
      now,
    });

    enriched.push({
      templateId: row.template_id,
      version: row.version,
      name: row.name,
      description: row.description,
      category: row.category,
      repoUrl: row.repo_url,
      lastCommitAt: row.last_commit_at,
      lastAuditedAt: lastAuditedAt
        ? new Date(Number(lastAuditedAt)).toISOString()
        : null,
      audit: audit
        ? {
            score: audit.score,
            grade: audit.grade ?? auditGradeFromScore(audit.score),
            scannedAt: new Date(audit.scannedAt).toISOString(),
          }
        : null,
      badge: badge.badge,
      badgeExpired: badge.expired,
    });
  }

  return enriched;
}

/**
 * @param {*} env
 * @param {{ templateId: string, version?: string, lastCommitAt?: string }} input
 */
export async function registerTemplateCommit(env, input) {
  if (!env?.DB) throw new Error("db_unavailable");
  const version = input.version ?? "1.0.0";
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO template_registry (template_id, version, name, description, category, last_commit_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'starter', ?, ?, ?)
     ON CONFLICT(template_id, version) DO UPDATE SET last_commit_at = excluded.last_commit_at, updated_at = excluded.updated_at`,
  )
    .bind(
      input.templateId,
      version,
      input.templateId,
      `${input.templateId} starter kit`,
      input.lastCommitAt ?? now,
      now,
      now,
    )
    .run();
  return { ok: true, templateId: input.templateId, version };
}
