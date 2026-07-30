/**
 * P18-D: DLP + PII Redaction Pipeline
 * Built-in regex patterns for sensitive data detection, custom DLP rules, and redaction.
 */

function generateId() {
  return `dlp_${crypto.randomUUID().slice(0, 12)}`;
}

function nowIso() {
  return new Date().toISOString();
}

/* ── Built-in DLP Patterns ── */

const BUILTIN_PATTERNS = [
  { type: "ssn", name: "US Social Security Number", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, severity: "high" },
  { type: "credit_card", name: "Credit Card Number", pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g, severity: "high" },
  { type: "email", name: "Email Address", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, severity: "medium" },
  { type: "phone", name: "Phone Number", pattern: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g, severity: "medium" },
  { type: "api_key", name: "API Key", pattern: /\b[A-Za-z0-9]{32,}\b/g, severity: "high" },
  { type: "jwt_token", name: "JWT Token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, severity: "high" },
  { type: "aws_key", name: "AWS Access Key", pattern: /\b(?:AKIA|ABIA|ACCA|ASIA)[A-Z0-9]{16}\b/g, severity: "critical" },
];

/* ── DLP Rule CRUD ── */

function mapDlpRuleRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    ruleType: row.rule_type ?? "regex",
    pattern: row.pattern,
    action: row.action ?? "redact",
    severity: row.severity ?? "medium",
    enabled: row.enabled === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapScanResultRow(row) {
  return {
    id: row.id,
    projectId: row.project_id,
    messageId: row.message_id ?? null,
    roomId: row.room_id ?? null,
    ruleId: row.rule_id,
    matchedText: row.matched_text ?? null,
    redactedText: row.redacted_text ?? null,
    actionTaken: row.action_taken,
    scannedAt: row.scanned_at,
  };
}

/**
 * Create a new custom DLP rule.
 */
export async function createDlpRule(env, { projectId, name, ruleType, pattern, action, severity }) {
  const id = generateId();
  const now = nowIso();
  const type = ["regex", "keyword", "pattern"].includes(ruleType) ? ruleType : "regex";
  const act = ["redact", "block", "alert", "log"].includes(action) ? action : "redact";
  const sev = ["low", "medium", "high", "critical"].includes(severity) ? severity : "medium";

  await env.DB.prepare(
    `INSERT INTO dlp_rules (id, project_id, name, rule_type, pattern, action, severity, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
  )
    .bind(id, projectId, name, type, pattern, act, sev, now, now)
    .run();

  return { id, projectId, name, ruleType: type, pattern, action: act, severity: sev, enabled: true, createdAt: now, updatedAt: now };
}

/**
 * List all custom DLP rules for a project.
 */
export async function listDlpRules(env, { projectId }) {
  const rows = await env.DB.prepare(
    `SELECT * FROM dlp_rules WHERE project_id = ? ORDER BY created_at DESC`
  )
    .bind(projectId)
    .all();
  return (rows.results || []).map(mapDlpRuleRow);
}

/**
 * Update an existing DLP rule.
 */
export async function updateDlpRule(env, { projectId, ruleId, name, ruleType, pattern, action, severity, enabled }) {
  const existing = await getDlpRule(env, { projectId, ruleId });
  if (!existing) return null;

  const now = nowIso();
  await env.DB.prepare(
    `UPDATE dlp_rules SET name = ?, rule_type = ?, pattern = ?, action = ?, severity = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND project_id = ?`
  )
    .bind(
      name ?? existing.name,
      ruleType ?? existing.ruleType,
      pattern ?? existing.pattern,
      action ?? existing.action,
      severity ?? existing.severity,
      enabled !== undefined ? (enabled ? 1 : 0) : (existing.enabled ? 1 : 0),
      now,
      ruleId,
      projectId,
    )
    .run();

  return getDlpRule(env, { projectId, ruleId });
}

/**
 * Delete a DLP rule.
 */
export async function deleteDlpRule(env, { projectId, ruleId }) {
  const result = await env.DB.prepare(
    `DELETE FROM dlp_rules WHERE id = ? AND project_id = ?`
  )
    .bind(ruleId, projectId)
    .run();
  if (!result.meta?.changes) return { ok: false, error: "not_found" };
  return { ok: true };
}

/**
 * Get a single DLP rule by ID.
 */
async function getDlpRule(env, { projectId, ruleId }) {
  const row = await env.DB.prepare(
    `SELECT * FROM dlp_rules WHERE id = ? AND project_id = ?`
  )
    .bind(ruleId, projectId)
    .first();
  return row ? mapDlpRuleRow(row) : null;
}

/* ── Scanning & Redaction ── */

/**
 * Scan text content for DLP matches (built-in patterns + project custom rules).
 * Returns array of { rule_id, rule_type, matched_text, redacted_text, severity, action }.
 */
export async function scanContent(env, { projectId, text }) {
  if (!text || typeof text !== "string") return [];

  const matches = [];

  // Scan built-in patterns
  for (const bp of BUILTIN_PATTERNS) {
    const regex = new RegExp(bp.pattern.source, bp.pattern.flags);
    let m;
    while ((m = regex.exec(text)) !== null) {
      matches.push({
        ruleId: `builtin_${bp.type}`,
        ruleType: bp.type,
        ruleName: bp.name,
        matchedText: m[0],
        redactedText: `[REDACTED-${bp.type.toUpperCase()}]`,
        severity: bp.severity,
        action: "redact",
      });
    }
  }

  // Scan custom project rules
  const customRules = await listDlpRules(env, { projectId });
  for (const rule of customRules) {
    if (!rule.enabled) continue;
    try {
      const regex = new RegExp(rule.pattern, "gi");
      let m;
      while ((m = regex.exec(text)) !== null) {
        matches.push({
          ruleId: rule.id,
          ruleType: rule.ruleType,
          ruleName: rule.name,
          matchedText: m[0],
          redactedText: `[REDACTED-${rule.name.toUpperCase().replace(/\s+/g, "_")}]`,
          severity: rule.severity,
          action: rule.action,
        });
      }
    } catch {
      // Skip invalid regex patterns
    }
  }

  return matches;
}

/**
 * Policy version fingerprint for DLP rule sets (builtin + custom).
 */
export async function getDlpPolicyVersion(env, { projectId }) {
  const rules = await listDlpRules(env, { projectId });
  const enabled = rules.filter((r) => r.enabled);
  const fingerprint = `${BUILTIN_PATTERNS.length}:${enabled.length}:${enabled.map((r) => `${r.id}:${r.updatedAt}`).join("|")}`;
  return {
    version: fingerprint.length > 64 ? `${fingerprint.slice(0, 32)}…${enabled.length}` : fingerprint,
    builtinPatternCount: BUILTIN_PATTERNS.length,
    customRuleCount: rules.length,
    enabledRuleCount: enabled.length,
    updatedAt: enabled[0]?.updatedAt ?? null,
  };
}

export async function scanContentKind(env, { projectId, text, contentKind }) {
  const kind = ["text", "file", "audio"].includes(contentKind) ? contentKind : "text";
  const normalized = kind === "text" ? text : typeof text === "string" ? text : "";
  const matches = await scanContent(env, { projectId, text: normalized });
  return { contentKind: kind, matches };
}

/**
 * Redact matched text segments, replacing each match with [REDACTED-{type}].
 */
export function redactText(text, matches) {
  if (!text || !matches || !matches.length) return text;

  // Sort matches by start position descending to replace from end to start
  const sortedMatches = [...matches].sort((a, b) => {
    const idxA = text.indexOf(a.matchedText);
    const idxB = text.indexOf(b.matchedText);
    return idxB - idxA;
  });

  let result = text;
  for (const match of sortedMatches) {
    const replacement = match.redactedText || `[REDACTED-${(match.ruleType || "unknown").toUpperCase()}]`;
    result = result.split(match.matchedText).join(replacement);
  }

  return result;
}

/**
 * Log DLP scan results to the database.
 */
export async function logDlpResult(env, { projectId, messageId, roomId, matches }) {
  if (!matches || !matches.length) return;

  const now = nowIso();
  const statements = [];
  for (const match of matches) {
    const id = generateId();
    statements.push(
      env.DB.prepare(
        `INSERT INTO dlp_scan_results (id, project_id, message_id, room_id, rule_id, matched_text, redacted_text, action_taken, scanned_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        id,
        projectId,
        messageId || null,
        roomId || null,
        match.ruleId,
        match.matchedText,
        match.redactedText || null,
        match.action,
        now,
      )
    );
  }

  if (statements.length > 0) {
    await env.DB.batch(statements);
  }
}
