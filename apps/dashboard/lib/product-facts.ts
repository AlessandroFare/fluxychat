/**
 * Public product facts for the dashboard. Keep in lockstep with docs/product-facts.json
 * (scripts/check-product-facts.mjs).
 */
export const PRODUCT_NAME = "FluxyChat";
export const PRODUCT_TAGLINE =
  "People and agents in the same room: chat, shared docs, tool calls. MIT Worker on your Cloudflare account, or hosted beta.";
export const PRODUCT_GITHUB_REPO = "https://github.com/AlessandroFare/fluxychat";
export const PRODUCT_GITHUB_ISSUES = `${PRODUCT_GITHUB_REPO}/issues`;
export const PRODUCT_SITE = "https://fluxychat.com";
export const PRODUCT_SUPPORT_EMAIL = "support@fluxychat.com";
export const PRODUCT_FOUNDER_EMAIL = "founder@fluxychat.com";
export const PRODUCT_BETA_BANNER =
  "Open beta. Self-host is MIT. Report a bug on GitHub.";

export function mailtoSupport(subject?: string): string {
  const base = `mailto:${PRODUCT_SUPPORT_EMAIL}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}

export function mailtoFounder(subject?: string): string {
  const base = `mailto:${PRODUCT_FOUNDER_EMAIL}`;
  if (!subject) return base;
  return `${base}?subject=${encodeURIComponent(subject)}`;
}
