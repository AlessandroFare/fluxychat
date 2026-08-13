/**
 * CP-046: Proactive embed trigger rules (URL pattern + dwell time).
 */

const MAX_RULES = 20;
const MAX_PATTERN_LEN = 200;
const MAX_MESSAGE_LEN = 160;

/**
 * @param {*} raw
 */
export function parseProactiveTriggers(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r) => r && typeof r === "object" && r.enabled !== false)
      .slice(0, MAX_RULES)
      .map(normalizeRule)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * @param {*} rule
 */
function normalizeRule(rule) {
  const urlPattern =
    typeof rule.urlPattern === "string" ? rule.urlPattern.trim().slice(0, MAX_PATTERN_LEN) : "";
  const dwellSeconds = Math.min(600, Math.max(0, Number(rule.dwellSeconds) || 0));
  const message =
    typeof rule.message === "string" ? rule.message.trim().slice(0, MAX_MESSAGE_LEN) : "";
  const id =
    typeof rule.id === "string" && rule.id.trim()
      ? rule.id.trim().slice(0, 64)
      : `rule_${urlPattern || "default"}_${dwellSeconds}`;

  return {
    id,
    enabled: rule.enabled !== false,
    urlPattern,
    dwellSeconds,
    message,
    autoOpen: Boolean(rule.autoOpen),
  };
}

/**
 * @param {unknown} input
 */
export function sanitizeProactiveTriggersInput(input) {
  if (!Array.isArray(input)) return [];
  return input
    .slice(0, MAX_RULES)
    .map(normalizeRule)
    .filter(Boolean);
}

/**
 * @param {string} pattern
 * @param {string} href
 */
export function urlMatchesProactivePattern(pattern, href) {
  if (!pattern) return true;
  let path = href;
  try {
    path = new URL(href, "https://example.com").pathname + new URL(href, "https://example.com").search;
  } catch {
    path = href;
  }
  if (pattern.startsWith("/")) {
    if (pattern.endsWith("*")) return path.startsWith(pattern.slice(0, -1));
    return path === pattern || path.startsWith(`${pattern}?`);
  }
  try {
    return new RegExp(pattern).test(href);
  } catch {
    return href.includes(pattern);
  }
}
