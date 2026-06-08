export const PRESENCE_INTENTS = ["composing", "away", "viewing_thread", "idle"];

/**
 * @param {unknown} raw
 * @param {boolean} isTyping
 * @returns {string}
 */
export function normalizePresenceIntent(raw, isTyping) {
  if (!isTyping) return "idle";
  const value = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (PRESENCE_INTENTS.includes(value) && value !== "idle") return value;
  return "composing";
}
