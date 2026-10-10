const SKEW_MS = 30_000;

export type VoiceTokenGrant = {
  displayName?: string;
  canPublish?: boolean;
  canSubscribe?: boolean;
  provider?: string;
};

export type VoiceTokenEnvelope = {
  ok: boolean;
  token: {
    expiresAt?: number;
    identity?: string;
    provider?: string;
    [key: string]: unknown;
  };
};

function grantKey(roomId: string, opts?: VoiceTokenGrant) {
  return [
    roomId,
    opts?.canPublish !== false ? "pub" : "nopub",
    opts?.canSubscribe !== false ? "sub" : "nosub",
    opts?.displayName || "",
  ].join(":");
}

function expiryMs(token: VoiceTokenEnvelope["token"]) {
  const n = Number(token?.expiresAt);
  if (Number.isFinite(n) && n > 0) return n;
  return Date.now() + 3_600_000;
}

/** LiveKit TokenSourceCached HOW — reuse until expiry or grants change. Not an SFU. */
export function createVoiceTokenSource(
  fetchToken: (roomId: string, opts?: VoiceTokenGrant) => Promise<VoiceTokenEnvelope>,
) {
  let cachedKey: string | null = null;
  let cached: VoiceTokenEnvelope | null = null;
  let cachedUntil = 0;

  return {
    async fetch(roomId: string, opts?: VoiceTokenGrant, force = false) {
      const key = grantKey(roomId, opts);
      if (!force && cached && cachedKey === key && Date.now() < cachedUntil) {
        return cached;
      }
      const next = await fetchToken(roomId, opts);
      cached = next;
      cachedKey = key;
      cachedUntil = expiryMs(next.token) - SKEW_MS;
      return next;
    },
    clear() {
      cached = null;
      cachedKey = null;
      cachedUntil = 0;
    },
  };
}
