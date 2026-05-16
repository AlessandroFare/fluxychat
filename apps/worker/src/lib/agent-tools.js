import { isPrivateUrl } from "./url-ssrf.js";
import { logInfo, logError } from "./worker-log.js";

export const CONTEXT_FETCH_TIMEOUT_MS = 5_000;
const TOOL_EXECUTE_TIMEOUT_MS = 30_000;

export async function executeToolCall(
  env,
  toolExecuteUrl,
  toolCall,
  projectId,
  runId,
  traceId
) {
  if (isPrivateUrl(toolExecuteUrl)) {
    return { success: false, error: "tool_execute_url_blocked_ssrf" };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TOOL_EXECUTE_TIMEOUT_MS);
  try {
    let args = {};
    try {
      args = JSON.parse(toolCall.arguments);
    } catch {
      args = {};
    }
    const res = await fetch(toolExecuteUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Fluxy-Project-Id": projectId,
        "X-Fluxy-Tool-Name": toolCall.name,
        "X-Fluxy-Trace-Id": traceId,
      },
      body: JSON.stringify({
        tool_name: toolCall.name,
        arguments: args,
        tool_call_id: toolCall.id,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { success: false, error: `tool_execute_http_${res.status}` };
    }
    const data = await res.json();
    return { success: true, result: data };
  } catch (err) {
    if (err.name === "AbortError") {
      logError(
        "agent.tool_call_timeout",
        new Error("tool execution timed out"),
        { projectId, toolName: toolCall.name, timeoutMs: TOOL_EXECUTE_TIMEOUT_MS, runId }
      );
      return { success: false, error: "tool_execution_timeout" };
    }
    logError("agent.invoke_failed", err, {
      projectId,
      toolName: toolCall.name,
      runId,
    });
    return { success: false, error: err.message || "tool_execution_failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAppContext(
  env,
  contextFetchUrl,
  projectId,
  roomId,
  userId,
  traceId
) {
  if (isPrivateUrl(contextFetchUrl)) {
    logInfo("agent.context_fetch_blocked_ssrf", { contextFetchUrl, projectId });
    return null;
  }
  const cacheKey = `ctx:${projectId}:${roomId}:${userId}:${contextFetchUrl}`;
  if (env.RATE_LIMIT_KV) {
    try {
      const cached = await env.RATE_LIMIT_KV.get(cacheKey);
      if (cached) {
        logInfo("agent.context_fetch_cache_hit", { projectId, roomId });
        return JSON.parse(cached);
      }
    } catch {
      // ignore cache read errors
    }
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONTEXT_FETCH_TIMEOUT_MS);
  try {
    const url = new URL(contextFetchUrl);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("roomId", roomId);
    url.searchParams.set("userId", userId);
    const res = await fetch(url.toString(), {
      headers: {
        "X-Fluxy-Project-Id": projectId,
        "X-Fluxy-Trace-Id": traceId,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (env.RATE_LIMIT_KV && data) {
      try {
        await env.RATE_LIMIT_KV.put(cacheKey, JSON.stringify(data), {
          expirationTtl: 60,
        });
      } catch {
        // ignore cache write errors
      }
    }
    return data;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
