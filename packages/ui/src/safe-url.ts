/**
 * URL sanitization for user-controlled values rendered into `href`/`src`.
 *
 * React does not sanitize attribute URLs, so a value like
 * `javascript:alert(1)` rendered into `<a href>` executes on click
 * (stored XSS). This helper allows only safe schemes and relative URLs.
 *
 * Allowed:
 *   - http:  / https:
 *   - mailto:
 *   - relative URLs (no scheme), e.g. `/attachments/abc`, `./x`, `img.png`
 *
 * Everything else (javascript:, data:, vbscript:, file:, etc.) returns
 * `undefined` so callers can omit the attribute / not render the link.
 */
const SAFE_ABSOLUTE_SCHEMES = new Set(["http:", "https:", "mailto:"]);

export function safeHttpUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Reject control characters (incl. NUL, newlines, tabs) that are
  // sometimes used to smuggle `java\nscript:` past naive checks.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(trimmed)) return undefined;

  // Detect an explicit scheme: `scheme:` at the very start. A leading
  // `//` (protocol-relative) or `/` (root-relative) or a bare path are
  // treated as relative and allowed.
  const schemeMatch = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(trimmed);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase() + ":";
    if (!SAFE_ABSOLUTE_SCHEMES.has(scheme)) return undefined;
  }

  return trimmed;
}
