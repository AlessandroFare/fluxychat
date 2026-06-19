/** Stable datetime formatting for SSR (avoid server/client locale mismatch). */
export function formatDateTime(
  isoOrMs: string | number | Date | null | undefined,
  locale = "en-US",
): string {
  if (isoOrMs == null || isoOrMs === "") return "—";
  const d = typeof isoOrMs === "string" || typeof isoOrMs === "number" ? new Date(isoOrMs) : isoOrMs;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
