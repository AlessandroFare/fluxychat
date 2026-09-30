/** Dashboard path for a public room live view. Token is unguessable, not the room id. */
export function publicSharePath(shareToken: string): string {
  return `/share/${encodeURIComponent(shareToken)}`;
}

/**
 * Absolute share URL. Only attach `pk_` as `?pk=` when the caller already has a publishable key.
 * Never put `fc_` on this URL.
 */
export function publicShareHref(
  origin: string,
  shareToken: string,
  publishableKey?: string,
): string {
  const base = origin.replace(/\/$/, "");
  const url = new URL(publicSharePath(shareToken), `${base}/`);
  const pk = publishableKey?.trim() ?? "";
  if (pk.startsWith("pk_")) url.searchParams.set("pk", pk);
  return url.toString();
}

export function isShareableToken(token: string): boolean {
  return /^[a-f0-9]{48}$/i.test(token);
}

/** @deprecated use isShareableToken */
export function isShareableRoomId(roomId: string): boolean {
  return isShareableToken(roomId) || /^[a-zA-Z0-9_-]{1,128}$/.test(roomId);
}
