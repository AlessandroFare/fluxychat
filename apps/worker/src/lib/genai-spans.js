/**
 * OpenTelemetry GenAI semantic conventions for room agent runs.
 * Spec status: Development. Split from semconv 1.42.0 (12 Jun 2026) into
 * semantic-conventions-genai. Room id is gen_ai.conversation.id when present.
 * @see https://github.com/open-telemetry/semantic-conventions-genai
 */

import { tracing } from "./tracing.js";
import { buildOtelTracePayload, buildTraceSpan, enqueueExport } from "./otel-export.js";

export const GENAI_SEMCONV = {
  spec: "semantic-conventions-genai",
  splitFromSemconv: "1.42.0",
  status: "Development",
};

export function hexIdFromKey(key, length = 32) {
  const hex = String(key || "")
    .replace(/-/g, "")
    .replace(/[^0-9a-f]/gi, "")
    .toLowerCase()
    .padEnd(length, "0");
  return hex.slice(0, length);
}

function fluxyIds(input, attrs) {
  if (input.runId) {
    attrs["fluxy.run_id"] = String(input.runId);
    attrs["fluxychat.run_id"] = String(input.runId);
  }
  if (input.projectId) {
    attrs["fluxy.project_id"] = String(input.projectId);
    attrs["fluxychat.project_id"] = String(input.projectId);
  }
  attrs["fluxy.genai_semconv"] = GENAI_SEMCONV.splitFromSemconv;
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
  if (input.agentName) attrs["gen_ai.agent.name"] = String(input.agentName);
  fluxyIds(input, attrs);
  return attrs;
}

export function buildGenAiInvokeAgentAttributes(input) {
  const attrs = {
    "gen_ai.operation.name": "invoke_agent",
  };
  if (input.agentName) attrs["gen_ai.agent.name"] = String(input.agentName);
  if (input.agentId) attrs["gen_ai.agent.id"] = String(input.agentId);
  if (input.roomId) attrs["gen_ai.conversation.id"] = String(input.roomId);
  if (input.model) attrs["gen_ai.request.model"] = String(input.model);
  fluxyIds(input, attrs);
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
  if (input.success === false) attrs["gen_ai.tool.status"] = "error";
  else if (input.success === true) attrs["gen_ai.tool.status"] = "ok";
  fluxyIds(input, attrs);
  return attrs;
}

export function buildGenAiApprovalAttributes(input) {
  const waitMs = Math.max(0, Number(input.waitMs) || 0);
  const attrs = {
    "fluxy.span.kind": "approval_wait",
    "fluxy.approval.id": String(input.approvalId || ""),
    "fluxy.approval.wait_ms": String(waitMs),
    "fluxy.approval.status": String(input.status || "pending"),
  };
  if (input.roomId) attrs["gen_ai.conversation.id"] = String(input.roomId);
  if (input.agentId) attrs["gen_ai.agent.id"] = String(input.agentId);
  if (input.decidedBy) attrs["fluxy.approval.decided_by"] = String(input.decidedBy);
  fluxyIds(input, attrs);
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
      parentSpanId: hexIdFromKey(input.runId || input.traceId, 16),
      name: "chat",
      startTime: startNano,
      endTime: endNano,
      status: input.ok === false ? "ERROR" : "OK",
      attributes: buildGenAiChatAttributes(input),
    });
    tracing.publish("ai.llm.end", { ...input, spanName: "chat" });
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
    const toolName = String(input.toolName || "unknown");
    const span = buildTraceSpan({
      traceId: hexIdFromKey(input.runId || input.traceId),
      parentSpanId: hexIdFromKey(input.runId || input.traceId, 16),
      name: `execute_tool ${toolName}`,
      startTime: startNano,
      endTime: endNano,
      status: input.success === false ? "ERROR" : "OK",
      attributes: buildGenAiToolAttributes(input),
    });
    tracing.publish("ai.tool.end", { ...input, spanName: span.name });
    void enqueueGenAiSpans(env, { projectId: input.projectId, spans: [span] });
    return span;
  } catch {
    return null;
  }
}

export function emitGenAiInvokeAgentSpan(env, input) {
  try {
    const started = Number(input.startedAtMs) || Date.now();
    const ended = Number(input.endedAtMs) || Date.now();
    const startNano = BigInt(started) * 1_000_000n;
    const endNano = BigInt(Math.max(ended, started)) * 1_000_000n;
    const agentName = String(input.agentName || input.agentId || "agent");
    const span = buildTraceSpan({
      traceId: hexIdFromKey(input.runId || input.traceId),
      spanId: hexIdFromKey(input.runId || input.traceId, 16),
      name: `invoke_agent ${agentName}`,
      startTime: startNano,
      endTime: endNano,
      status: input.ok === false ? "ERROR" : "OK",
      attributes: buildGenAiInvokeAgentAttributes(input),
    });
    tracing.publish("ai.agent.end", { ...input, spanName: span.name });
    void enqueueGenAiSpans(env, { projectId: input.projectId, spans: [span] });
    return span;
  } catch {
    return null;
  }
}

export function emitGenAiApprovalWaitSpan(env, input) {
  try {
    const started = Number(input.startedAtMs) || Date.now();
    const ended = Number(input.endedAtMs) || Date.now();
    const startNano = BigInt(started) * 1_000_000n;
    const endNano = BigInt(Math.max(ended, started)) * 1_000_000n;
    const span = buildTraceSpan({
      traceId: hexIdFromKey(input.runId || input.traceId || input.approvalId),
      parentSpanId: hexIdFromKey(input.runId || input.traceId || input.approvalId, 16),
      name: "fluxy.approval.wait",
      startTime: startNano,
      endTime: endNano,
      status: input.status === "denied" ? "ERROR" : "OK",
      attributes: buildGenAiApprovalAttributes({
        ...input,
        waitMs: Math.max(0, ended - started),
      }),
    });
    tracing.publish("ai.approval.end", { ...input, spanName: "fluxy.approval.wait" });
    void enqueueGenAiSpans(env, { projectId: input.projectId, spans: [span] });
    return span;
  } catch {
    return null;
  }
}
