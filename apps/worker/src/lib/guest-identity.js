/**
 * Stable anonymous identity for public rooms (localStorage guestKey → SHA-256 user id).
 * Never accept a client-supplied userId.
 */

/**
 * @param {string} projectId
 * @param {string} roomId
 * @param {unknown} guestKey
 * @returns {Promise<string | null>}
 */
export async function deriveStableGuestUserId(projectId, roomId, guestKey) {
  const key = String(guestKey || "").trim();
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(key)) return null;
  const bytes = new TextEncoder().encode(`fluxy-guest-v1:${projectId}:${roomId}:${key}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `guest_${hex.slice(0, 22)}`;
}
