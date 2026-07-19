const API_ROOT = "https://api.cloudflare.com/client/v4";

function requireConfig(env) {
  const accountId = String(env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = String(env.CLOUDFLARE_STREAM_API_TOKEN || "").trim();
  const customerCode = String(env.CLOUDFLARE_STREAM_CUSTOMER_CODE || "").trim();
  if (!accountId || !token || !customerCode) {
    throw new Error("cloudflare_stream_not_configured");
  }
  return { accountId, token, customerCode };
}

async function streamApi(env, path, init = {}) {
  const { accountId, token } = requireConfig(env);
  const response = await fetch(`${API_ROOT}/accounts/${accountId}/stream${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    const message = body?.errors?.[0]?.message || `cloudflare_stream_${response.status}`;
    throw new Error(message);
  }
  return body.result;
}

export async function createLiveInput(env, { eventId, projectId, title }) {
  const { customerCode } = requireConfig(env);
  const input = await streamApi(env, "/live_inputs", {
    method: "POST",
    body: JSON.stringify({
      enabled: true,
      meta: { eventId, projectId, name: title },
      preferLowLatency: true,
      recording: { mode: "automatic", hideLiveViewerCount: true },
    }),
  });
  return {
    uid: input.uid,
    rtmpsUrl: input.rtmps?.url || null,
    streamKey: input.rtmps?.streamKey || null,
    whipUrl: input.webRTC?.url || null,
    streamUrl: `https://customer-${customerCode}.cloudflarestream.com/${input.uid}/iframe`,
    playbackHls: `https://customer-${customerCode}.cloudflarestream.com/${input.uid}/manifest/video.m3u8`,
    playbackDash: `https://customer-${customerCode}.cloudflarestream.com/${input.uid}/manifest/video.mpd`,
    providerState: input.status || null,
  };
}

export async function deleteLiveInput(env, uid) {
  await streamApi(env, `/live_inputs/${encodeURIComponent(uid)}`, { method: "DELETE" });
}
