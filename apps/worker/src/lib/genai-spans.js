/**
 * OpenTelemetry GenAI semantic conventions for room agent runs (CF-A-022).
 * @see https://opentelemetry.io/docs/specs/semconv/gen-ai/
 */

import { tracing } from "./tracing.js";
import { buildOtelTracePayload, buildTraceSpan, enqueueExport } from "./otel-export.js";

export function hexIdFromKey(key, length = 32) {
  const hex = String(key || "")
    .replace(/-/g, "")
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase()
    .padEnd(length, "0");
  return hex.slice(0, length);
}

export function buildGenAiChatAttributes(input) {
  const attrs = {
    "gen_ai.operation.name": "chat",
    "gen_ai.provider.name": String(input.provider || "unknown"),
    "gen_ai.request.model": String(input.model || "unknown"),
    "gen_ai.usage.input_tokens": String(Number(input.inputTokens) || 0),
    "gen_ai.usage.output_tokens": String(Number(input.outputTokens) || 0),
  };
  if (input.finishReason) attrs["gen_ai.response.finish_reasons"] = String(input.finishReason);
  if (input.roomId) attrs["gen_ai.conversation.id"] = String(input.roomId);
  if (input.agentId) attrs["gen_ai.agent.id"] = String(input.agentId);
  if (input.runId) attrs["fluxychat.run_id"] = String(input.runId);
  if (input.projectId) attrs["fluxychat.project_id"] = String(input.projectId);
  return attrs;
}

export function buildGenAiToolAttributes(input) {
  const attrs = {
    "gen_ai.operation.name": "execute_tool",
    "gen_ai.tool.name": String(input.toolName || "unknown"),
    "gen_ai.tool.call.id": String(input.toolCallId || ""),
  };
  if (input.roomId) attrs["gen_ai.conversation.id"] = String(input.roomId);
  if (input.agentId) attrs["gen_ai.agent.id"] = String(input.agentId);
  if (input.runId) attrs["fluxychat.run_id"] = String(input.runId);
  if (input.projectId) attrs["fluxychat.project_id"] = String(input.projectId);
  if (input.success === false) attrs["gen_ai.tool.status"] = "error";
  else if (input.success === true) attrs["gen_ai.tool.status"] = "ok";
  return attrs;
}

export function tokenUsageFromLlmResponse(response, anthropic) {
  if (!response || typeof response !== "object") {
    return { inputTokens: 0, outputTokens: 0 };
  }
  const usage = response.usage || {};
  if (anthropic) {
    return {
      inputTokens: Number(usage.input_tokens) || 0,
      outputTokens: Number(usage.output_tokens) || 0,
    };
  }
  return {
    inputTokens: Number(usage.prompt_tokens) || 0,
    outputTokens: Number(usage.completion_tokens) || 0,
  };
}

/**
 * Best-effort: queue GenAI spans to every enabled project OTLP config.
 * Never throws into the agent loop.
 */
export async function enqueueGenAiSpans(env, { projectId, spans }) {
  if (!env?.DB || !projectId || !spans?.length) return { queued: 0 };
  try {
    const configs = await env.DB.prepare(
      `SELECT id FROM otel_export_config WHERE project_id = ? AND enabled = 1 AND export_type IN ('traces', 'all')`,
    )
      .bind(projectId)
      .all();
    if (!configs.results?.length) return { queued: 0 };
    const payload = buildOtelTracePayload(spans);
    for (const cfg of configs.results) {
      await enqueueExport(env, {
        configId: cfg.id,
        projectId,
        payloadType: "trace",
        payload,
      });
    }
    return { queued: configs.results.length, spanCount: spans.length };
  } catch {
    return { queued: 0 };
  }
}

export function emitGenAiChatSpan(env, input) {
  try {
    const started = Number(input.startedAtMs) || Date.now();
    const ended = Number(input.endedAtMs) || Date.now();
    const startNano = BigInt(started) * 1_000_000n;
    const endNano = BigInt(Math.max(ended, started)) * 1_000_000n;
    const span = buildTraceSpan({
      traceId: hexIdFromKey(input.runId || input.traceId),
      name: "chat",
      startTime: startNano,
      endTime: endNano,
      status: input.ok === false ? "ERROR" : "OK",
      attributes: buildGenAiChatAttributes(input),
    });
    tracing.publish("ai.llm.end", {
      ...input,
      spanName: "chat",
    });
    void enqueueGenAiSpans(env, { projectId: input.projectId, spans: [span] });
    return span;
  } catch {
    return null;
  }
}

export function emitGenAiToolSpan(env, input) {
  try {
    const started = Number(input.startedAtMs) || Date.now();
    const ended = Number(input.endedAtMs) || Date.now();
    const startNano = BigInt(started) * 1_000_000n;
    const endNano = BigInt(Math.max(ended, started)) * 1_000_000n;
    const span = buildTraceSpan({
      traceId: hexIdFromKey(input.runId || input.traceId),
      name: "execute_tool",
      startTime: startNano,
      endTime: endNano,
      status: input.success === false ? "ERROR" : "OK",
      attributes: buildGenAiToolAttributes(input),
    });
    tracing.publish("ai.tool.end", { ...input, spanName: "execute_tool" });
    void enqueueGenAiSpans(env, { projectId: input.projectId, spans: [span] });
    return span;
  } catch {
    return null;
  }
}
