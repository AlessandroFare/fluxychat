/**
 * Canonical outbound webhook event types (G-8 / PL-20.2).
 * Keep in sync with apps/docs/content/docs/webhooks/catalog.mdx
 */

export const WEBHOOK_EVENT_TYPES = [
  "message.created",
  "mention",
  "report.created",
  "moderation.auto_flag",
  "room.occupied",
  "room.vacated",
  "member_joined",
  "member_left",
  "subscription_count",
  "client_event",
  "cache_miss",
  "user.event",
];

const KNOWN = new Set(WEBHOOK_EVENT_TYPES);

/**
 * @param {string[]} eventTypes
 * @returns {{ ok: true } | { ok: false, unknown: string[] }}
 */
export function validateWebhookEventTypes(eventTypes) {
  if (!Array.isArray(eventTypes) || eventTypes.length === 0) {
    return { ok: false, unknown: ["(empty)"] };
  }
  const unknown = eventTypes.filter((t) => typeof t !== "string" || !KNOWN.has(t.trim()));
  if (unknown.length) return { ok: false, unknown };
  return { ok: true };
}
