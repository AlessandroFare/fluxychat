import { PROTOCOL_VERSION, UPGRADE_PARAMS } from "@portalsdk/wire-protocol";

/** UTF-8-safe base64 of a JSON value, for the `meta` upgrade param (§1.1). */
function toBase64Json(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export interface ChannelUpgradeParams {
  realtimeUrl: string;
  channelId: string;
  /** Resolved signed JWT. */
  token: string;
  /** Publishable app key. */
  apiKey: string;
  /** Sticky reconnect hint from a prior `ready`; echoed unchanged. */
  leaf?: string | undefined;
  /** Initial presence metadata (standard channels; base64-JSON on the wire). */
  meta?: Record<string, unknown> | undefined;
  /** Highest contiguous seq held, sent on reconnect to request replay (§1.4). */
  last?: number | undefined;
}

/** Build a channel socket upgrade URL (§1.1). */
export function buildChannelUpgradeUrl(params: ChannelUpgradeParams): string {
  const { realtimeUrl, channelId, token, apiKey, leaf, meta, last } = params;
  const url = new URL(`${realtimeUrl}/v1/channels/${encodeURIComponent(channelId)}`);
  const q = url.searchParams;
  q.set(UPGRADE_PARAMS.version, String(PROTOCOL_VERSION));
  q.set(UPGRADE_PARAMS.token, token);
  q.set(UPGRADE_PARAMS.key, apiKey);
  if (leaf !== undefined) q.set(UPGRADE_PARAMS.leaf, leaf);
  if (meta !== undefined) q.set(UPGRADE_PARAMS.meta, toBase64Json(meta));
  if (last !== undefined) q.set(UPGRADE_PARAMS.last, String(last));
  return url.toString();
}

export interface InboxUpgradeParams {
  realtimeUrl: string;
  token: string;
  apiKey: string;
}

/** Build an inbox socket upgrade URL (§5). No `leaf`/`last`/`meta` — the inbox has no seq stream. */
export function buildInboxUpgradeUrl(params: InboxUpgradeParams): string {
  const url = new URL(`${params.realtimeUrl}/inbox`);
  const q = url.searchParams;
  q.set(UPGRADE_PARAMS.version, String(PROTOCOL_VERSION));
  q.set(UPGRADE_PARAMS.token, params.token);
  q.set(UPGRADE_PARAMS.key, params.apiKey);
  return url.toString();
}

/**
 * Convert a `ws(s)://` upgrade URL to the `http(s)://` URL for the same endpoint.
 *
 * A refused upgrade is delivered as an HTTP 4xx (§1.1) that a browser WebSocket cannot
 * read. Probing the same endpoint over HTTP recovers the refusal code from the body and
 * the `x-portal-error` header.
 */
export function upgradeUrlToHttpProbe(wsUrl: string): string {
  const url = new URL(wsUrl);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  return url.toString();
}
