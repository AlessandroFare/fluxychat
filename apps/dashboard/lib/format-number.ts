/** Stable number formatting for SSR (avoid server/client locale mismatch). */
export function formatNumber(value: number, locale = "en-US"): string {
  return new Intl.NumberFormat(locale).format(value);
}

export const ANALYTICS_CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type AnalyticsCurrency = (typeof ANALYTICS_CURRENCIES)[number];

export const ANALYTICS_CURRENCY_STORAGE_KEY = "fluxy-analytics-currency";

export function inferAnalyticsCurrency(locale = "en-US"): AnalyticsCurrency {
  const tag = locale.toLowerCase();
  if (tag.startsWith("en-gb") || tag.includes("-gb")) return "GBP";
  if (
    tag.startsWith("de") ||
    tag.startsWith("fr") ||
    tag.startsWith("it") ||
    tag.startsWith("es") ||
    tag.startsWith("nl") ||
    tag.startsWith("pt") ||
    tag.includes("-eu")
  ) {
    return "EUR";
  }
  return "USD";
}

export function isAnalyticsCurrency(value: string): value is AnalyticsCurrency {
  return (ANALYTICS_CURRENCIES as readonly string[]).includes(value);
}

/** Round binary float noise (e.g. 0.09999999999999999 → 0.1). */
export function roundMoney(value: number, fractionDigits = 4): number {
  if (!Number.isFinite(value)) return 0;
  const f = 10 ** fractionDigits;
  return Math.round((value + Number.EPSILON) * f) / f;
}

export function formatMoney(
  value: number,
  currency: AnalyticsCurrency,
  locale = "en-US",
  fractionDigits?: { min?: number; max?: number },
): string {
  const min = fractionDigits?.min ?? 2;
  const max = fractionDigits?.max ?? 4;
  const rounded = roundMoney(value, max);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  }).format(rounded);
}
