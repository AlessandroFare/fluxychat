/**
 * C4: optional guardrails around governed MCP calls (pre: arguments, post:
 * payload). A guardrail is a named regular expression: `block` stops the call,
 * `redact` rewrites the matching text and records the rule name in the
 * tool-call log. Deterministic and local — no external policy engine.
 *
 *   guardrails: {
 *     enabled: true,
 *     block: [{ name: "aws_key", pattern: "AKIA[0-9A-Z]{16}" }],
 *     redact: [{ name: "email", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+" }],
 *   }
 *
 * Patterns match case-sensitively on strings, at most OPS_GUARDRAIL_MAX_DEPTH
 * levels deep into the payload. Invalid patterns are dropped at normalization,
 * never at call time.
 */

export const OPS_GUARDRAIL_MAX_RULES = 25;
export const OPS_GUARDRAIL_MAX_PATTERN = 200;
export const OPS_GUARDRAIL_MAX_DEPTH = 6;

function normalizeRule(raw) {
  const name = String(raw?.name || "")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "")
    .slice(0, 64);
  const pattern = String(raw?.pattern || "").slice(0, OPS_GUARDRAIL_MAX_PATTERN);
  if (!name || !pattern) return null;
  try {
    new RegExp(pattern);
  } catch {
    return null;
  }
  return { name, pattern };
}

function normalizeRules(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, OPS_GUARDRAIL_MAX_RULES)
    .map(normalizeRule)
    .filter(Boolean);
}

/** Idempotent: safe to call on a raw stored policy or an already-normalized one. */
export function normalizeGuardrails(raw) {
  if (!raw || typeof raw !== "object") return { enabled: false, block: [], redact: [] };
  return {
    enabled: raw.enabled === true || raw.enabled === "true" || raw.enabled === 1,
    block: normalizeRules(raw.block),
    redact: normalizeRules(raw.redact),
  };
}

function walkStrings(value, fn, depth = 0) {
  if (typeof value === "string") return fn(value);
  if (depth >= OPS_GUARDRAIL_MAX_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => walkStrings(item, fn, depth + 1));
  if (value && typeof value === "object") {
    const out = {};
    for (const [key, item] of Object.entries(value)) out[key] = walkStrings(item, fn, depth + 1);
    return out;
  }
  return value;
}

function firstMatch(rules, value) {
  if (!rules.length) return null;
  let hit = null;
  walkStrings(value, (text) => {
    if (hit) return text;
    for (const rule of rules) {
      if (new RegExp(rule.pattern).test(text)) {
        hit = rule.name;
        break;
      }
    }
    return text;
  });
  return hit;
}

function redactValue(rules, value) {
  const applied = new Set();
  const rewritten = walkStrings(value, (text) => {
    let out = text;
    for (const rule of rules) {
      const next = out.replace(new RegExp(rule.pattern, "g"), `[redacted:${rule.name}]`);
      if (next !== out) {
        applied.add(rule.name);
        out = next;
      }
    }
    return out;
  });
  return { value: rewritten, redacted: [...applied] };
}

/** Pre-call: scan the arguments. A block stops the call before it leaves. */
export function applyInputGuardrails(guardrails, input) {
  const g = normalizeGuardrails(guardrails);
  if (!g.enabled) return { ok: true, input, redacted: [] };
  const blockedBy = firstMatch(g.block, input);
  if (blockedBy) return { ok: false, error: "guardrail_blocked", rule: blockedBy, stage: "input" };
  const { value, redacted } = redactValue(g.redact, input);
  return { ok: true, input: value, redacted };
}

/** Post-call: scan the payload. A block drops it; redaction rewrites it. */
export function applyOutputGuardrails(guardrails, payload) {
  const g = normalizeGuardrails(guardrails);
  if (!g.enabled) return { ok: true, payload, redacted: [] };
  const blockedBy = firstMatch(g.block, payload);
  if (blockedBy) return { ok: false, error: "guardrail_blocked", rule: blockedBy, stage: "output" };
  const { value, redacted } = redactValue(g.redact, payload);
  return { ok: true, payload: value, redacted };
}
