import type { PortalConfig } from "./types.js";

/** Production hosts, baked in. Overridable via `PortalConfig.apiUrl`/`realtimeUrl`. */
export const DEFAULT_API_URL = "https://api.useportal.co";
export const DEFAULT_REALTIME_URL = "wss://realtime.useportal.co";

export interface ResolvedHosts {
  /** HTTP base for the anonymous-token mint route (no trailing slash). */
  apiUrl: string;
  /** WebSocket base for channel and inbox upgrades (no trailing slash). */
  realtimeUrl: string;
  /** HTTP base for publish, history, and members — `realtimeUrl` over ws(s)→http(s). */
  realtimeHttpUrl: string;
}

const trimTrailingSlash = (url: string): string => url.replace(/\/+$/, "");

/** `wss://` → `https://`, `ws://` → `http://`; the rest of the origin is unchanged. */
function wsToHttpOrigin(url: string): string {
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

/** Resolve the effective hosts, applying overrides and normalising trailing slashes. */
export function resolveHosts(config: PortalConfig): ResolvedHosts {
  const realtimeUrl = trimTrailingSlash(config.realtimeUrl ?? DEFAULT_REALTIME_URL);
  return {
    apiUrl: trimTrailingSlash(config.apiUrl ?? DEFAULT_API_URL),
    realtimeUrl,
    realtimeHttpUrl: wsToHttpOrigin(realtimeUrl),
  };
}
