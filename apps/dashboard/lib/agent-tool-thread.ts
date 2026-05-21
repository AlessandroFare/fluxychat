import type { FluxyChatEvent } from "@fluxy-chat/sdk";
import { parseToolCallsJson, type AgentToolCallDisplay } from "@/lib/agent-run-display";

export type AgentToolThreadKind = "tool_call" | "tool_result" | "tool_error";

export interface AgentToolThreadEvent {
  key: string;
  kind: AgentToolThreadKind;
  runId: string;
  toolCallId: string;
  name: string;
  arguments?: string;
  resultPreview?: string | null;
  error?: string | null;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function previewResult(result: unknown): string {
  try {
    return truncate(JSON.stringify(result), 160);
  } catch {
    return String(result);
  }
}

export function fluxyEventToToolThreadEvent(data: FluxyChatEvent): AgentToolThreadEvent | null {
  if (data.type === "tool_call") {
    return {
      key: `${data.runId}:${data.toolCallId}:call`,
      kind: "tool_call",
      runId: data.runId,
      toolCallId: data.toolCallId,
      name: data.name,
      arguments: data.arguments,
    };
  }
  if (data.type === "tool_result") {
    return {
      key: `${data.runId}:${data.toolCallId}:result`,
      kind: "tool_result",
      runId: data.runId,
      toolCallId: data.toolCallId,
      name: data.name,
      resultPreview: previewResult(data.result),
    };
  }
  if (data.type === "tool_error") {
    return {
      key: `${data.runId}:${data.toolCallId}:error`,
      kind: "tool_error",
      runId: data.runId,
      toolCallId: data.toolCallId,
      name: data.name,
      error: data.error ?? "tool_failed",
    };
  }
  return null;
}

/** Expand persisted run tool_calls into thread cards (call + result/error). */
export function toolCallsToThreadEvents(
  runId: string,
  toolCalls: AgentToolCallDisplay[],
): AgentToolThreadEvent[] {
  const events: AgentToolThreadEvent[] = [];
  for (const tc of toolCalls) {
    events.push({
      key: `${runId}:${tc.id}:call`,
      kind: "tool_call",
      runId,
      toolCallId: tc.id,
      name: tc.name,
      arguments: tc.arguments,
    });
    if (tc.success === false) {
      events.push({
        key: `${runId}:${tc.id}:error`,
        kind: "tool_error",
        runId,
        toolCallId: tc.id,
        name: tc.name,
        error: tc.resultPreview ?? "tool_failed",
      });
    } else if (tc.success === true || tc.resultPreview) {
      events.push({
        key: `${runId}:${tc.id}:result`,
        kind: "tool_result",
        runId,
        toolCallId: tc.id,
        name: tc.name,
        resultPreview: tc.resultPreview,
      });
    }
  }
  return events;
}

export function mergeToolThreadEvents(
  existing: AgentToolThreadEvent[],
  incoming: AgentToolThreadEvent[],
): AgentToolThreadEvent[] {
  const byKey = new Map<string, AgentToolThreadEvent>();
  for (const e of existing) byKey.set(e.key, e);
  for (const e of incoming) byKey.set(e.key, e);
  return Array.from(byKey.values());
}

export function toolCallsFromAgentRunPayload(run: Record<string, unknown>): AgentToolCallDisplay[] {
  return parseToolCallsJson(run.tool_calls ?? run.tool_calls_json ?? run.toolCalls);
}
