/** Late-joiner JSON bag on the room Durable Object (Portal-style snapshot, not a CRDT). */

export const DERIVED_MAX_BYTES = 16_384;
export const DERIVED_SET_MAX_PER_MINUTE = 30;

/**
 * @param {unknown} raw
 * @returns {{ ok: true, state: Record<string, unknown> } | { ok: false, error: string }}
 */
export function sanitizeDerivedState(raw) {
  if (raw == null) return { ok: true, state: {} };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "derived_must_be_object" };
  }
  let encoded;
  try {
    encoded = JSON.stringify(raw);
  } catch {
    return { ok: false, error: "derived_not_json" };
  }
  if (encoded.length > DERIVED_MAX_BYTES) {
    return { ok: false, error: "derived_too_large" };
  }
  try {
    const parsed = JSON.parse(encoded);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "derived_must_be_object" };
    }
    return { ok: true, state: parsed };
  } catch {
    return { ok: false, error: "derived_not_json" };
  }
}
