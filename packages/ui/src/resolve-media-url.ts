/**
 * Resolve attachment/media URLs returned by the Worker (often relative `/attachments/...`).
 */
export function resolveMediaUrl(
  url: string | null | undefined,
  baseUrl?: string | null,
): string | undefined {
  if (!url || typeof url !== "string") return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  if (!baseUrl) return trimmed
  const base = baseUrl.replace(/\/$/, "")
  return trimmed.startsWith("/") ? `${base}${trimmed}` : `${base}/${trimmed}`
}
