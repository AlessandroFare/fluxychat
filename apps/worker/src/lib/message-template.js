const TEMPLATE_VAR_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
const TEMPLATE_NAME_RE = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidTemplateName(name) {
  return typeof name === "string" && TEMPLATE_NAME_RE.test(name.trim());
}

/**
 * @param {string} body
 * @param {Record<string, string | number | boolean | null | undefined>} [vars]
 */
export function renderMessageTemplate(body, vars = {}) {
  if (typeof body !== "string") return "";
  return body.replace(TEMPLATE_VAR_RE, (_match, key) => {
    const value = vars[key];
    if (value === undefined || value === null) return "";
    return String(value);
  });
}

/**
 * @param {unknown} raw
 * @returns {Record<string, string> | null}
 */
export function normalizeTemplateVars(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
    if (value === undefined || value === null) continue;
    out[key] = String(value).slice(0, 2000);
  }
  return out;
}
