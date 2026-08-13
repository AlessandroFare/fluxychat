/**
 * NW-120: Outbound fetch helper for Durable Object / Worker agent streaming.
 *
 * Cloudflare keeps DOs alive for the duration of active outbound connections
 * (fetch/WebSocket) up to ~15 minutes (Jun 2026). Use this wrapper for LLM
 * streaming and long-running tool calls so mid-stream eviction is less likely.
 *
 * @see https://developers.cloudflare.com/changelog/post/2026-06-19-outbound-connections-keep-dos-alive/
 */

/** @typedef {{ feature?: string, projectId?: string, roomId?: string, runId?: string }} DoOutboundMeta */

/**
 * @param {string | URL | Request} input
 * @param {RequestInit} [init]
 * @param {DoOutboundMeta} [meta]
 */
export async function fetchWithDoKeepalive(input, init, meta) {
  const startedAt = Date.now();
  try {
    const res = await fetch(input, init);
    return res;
  } finally {
    const ms = Date.now() - startedAt;
    if (meta?.feature && typeof globalThis !== "undefined") {
      // Structured log hook — agent-runtime / llm-stream pass feature tags.
      const logFn = globalThis.__fluxyOutboundLog;
      if (typeof logFn === "function") {
        logFn({ ...meta, durationMs: ms, ok: true });
      }
    }
  }
}

/**
 * Tag outbound streams so operators can grep `agent.llm_stream_outbound`.
 *
 * @param {DoOutboundMeta} meta
 */
export function outboundStreamTags(meta) {
  return {
    "X-Fluxy-Outbound-Feature": meta.feature ?? "unknown",
    ...(meta.projectId ? { "X-Fluxy-Project-Id": meta.projectId } : {}),
    ...(meta.roomId ? { "X-Fluxy-Room-Id": meta.roomId } : {}),
    ...(meta.runId ? { "X-Fluxy-Run-Id": meta.runId } : {}),
  };
}
