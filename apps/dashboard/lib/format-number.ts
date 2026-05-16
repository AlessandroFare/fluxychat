/** Stable number formatting for SSR (avoid server/client locale mismatch). */
export function formatNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale).format(value);
}
