/**
 * Read non-sensitive claims from a Fluxy JWT (no signature verify — UI hints only).
 */
export function readJwtTenantId(token: string): string | null {
  const trimmed = token.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(".");
  if (parts.length < 2) return null;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const json = JSON.parse(atob(padded)) as { tid?: unknown };
    return typeof json.tid === "string" ? json.tid : null;
  } catch {
    return null;
  }
}
