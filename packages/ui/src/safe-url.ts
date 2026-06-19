/**
 * Sanitize a user-controlled URL before placing it in href/src.
 *
 * Blocks dangerous schemes such as `javascript:` and `vbscript:` that would
 * execute script when a link is clicked (stored XSS). Returns `undefined` for
 * anything that is not an allowed scheme so callers can omit the attribute.
 *
 * @param raw the untrusted URL
 * @param opts.allowData allow `data:`/`blob:` (use only for image src, never href)
 */
export function safeUrl(
  raw: string | undefined | null,
  opts: { allowData?: boolean } = {},
): string | undefined {
  if (!raw) return undefined;
  // Reject non-string input (numbers, objects, etc.) outright rather than
  // coercing via String(). This prevents `safeUrl(123)` from returning "123".
  if (typeof raw !== "string") return undefined;
  // Strip control characters (null bytes, tabs, newlines, etc.) to defeat
  // scheme obfuscation like "java\x00script:alert(1)".  If stripping changed
  // the string, reject even if the cleaned result looks like a safe scheme —
  // the control characters are a strong signal of a bypass attempt.
  const cleaned = raw.replace(/[\x00-\x1f\x7f]/g, "");
  if (cleaned !== raw) return undefined;
  const trimmed = cleaned.trim();
  if (!trimmed) return undefined;

  // Relative URLs (no scheme) are safe — they cannot be javascript:.
  // A leading "/", "./", "../", "#" or "?" has no scheme.
  if (/^(?:[/?#.]|$)/.test(trimmed)) return trimmed;

  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (!schemeMatch) {
    // No recognizable scheme and not clearly relative — treat as relative.
    return trimmed;
  }
  const scheme = schemeMatch[1].toLowerCase();
  const allowed = new Set(["http", "https", "mailto", "tel"]);
  if (opts.allowData) {
    allowed.add("data");
    allowed.add("blob");
  }
  return allowed.has(scheme) ? trimmed : undefined;
}
