/**
 * Canonical stream part bridge — unifies agent runtime parts, AG-UI events, and UIParts.
 * Mirrors `packages/agent/src/ai-core.ts` AIStreamPart without a runtime dependency.
 */

import { createAgUiAdapter, type AgUiStreamEvent } from "./ag-ui-adapter";
import {
  createTextPart,
  createToolCallPart,
  createToolResultPart,
  type UIPart,
} from "./generative-ui";

export type FluxyCanonicalStreamPart =
  | { type: "text-delta"; id?: string; delta: string }
  | { type: "tool-input-available"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; toolName?: string; output: unknown }
  | { type: "tool-error"; toolCallId: string; toolName?: string; error: string }
  | { type: "finish"; finishReason?: string }
  | { type: "error"; error: string };

/** Map agent-runtime stream part JSON to canonical SDK part. */
export function agentStreamPartToCanonical(part: Record<string, unknown>): FluxyCanonicalStreamPart | null {
  const type = String(part.type ?? "");
  switch (type) {
    case "text-delta":
      return {
        type: "text-delta",
        id: part.id != null ? String(part.id) : undefined,
        delta: String(part.delta ?? ""),
      };
    case "tool-input-available":
      return {
        type: "tool-input-available",
        toolCallId: String(part.toolCallId ?? ""),
        toolName: String(part.toolName ?? "tool"),
        input: part.input,
      };
    case "tool-output-available":
      return {
        type: "tool-output-available",
        toolCallId: String(part.toolCallId ?? ""),
        toolName: part.toolName != null ? String(part.toolName) : undefined,
        output: part.output,
      };
    case "tool-error":
      return {
        type: "tool-error",
        toolCallId: String(part.toolCallId ?? ""),
        toolName: part.toolName != null ? String(part.toolName) : undefined,
        error: String((part.error as { message?: string })?.message ?? part.error ?? "tool_error"),
      };
    case "finish":
      return { type: "finish", finishReason: String(part.finishReason ?? "stop") };
    case "error":
      return {
        type: "error",
        error: String((part.error as { message?: string })?.message ?? part.error ?? "stream_error"),
      };
    default:
      return null;
  }
}

export function canonicalStreamPartToAgUiEvent(part: FluxyCanonicalStreamPart): AgUiStreamEvent | null {
  switch (part.type) {
    case "text-delta":
      return { type: "text_delta", delta: part.delta };
    case "tool-input-available":
      return {
        type: "tool_call",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        args: typeof part.input === "object" && part.input !== null
          ? (part.input as Record<string, unknown>)
          : { value: part.input },
      };
    case "tool-output-available":
      return {
        type: "tool_result",
        toolCallId: part.toolCallId,
        toolName: part.toolName ?? "tool",
        output: part.output,
      };
    case "tool-error":
      return {
        type: "tool_result",
        toolCallId: part.toolCallId,
        toolName: part.toolName ?? "tool",
        ok: false,
        error: part.error,
      };
    case "finish":
      return { type: "run_finished", finishReason: part.finishReason };
    case "error":
      return { type: "error", message: part.error };
    default:
      return null;
  }
}

export function canonicalStreamPartsToUiParts(parts: FluxyCanonicalStreamPart[]): UIPart[] {
  const adapter = createAgUiAdapter();
  let state = adapter.createRun("bridge");
  for (const part of parts) {
    const event = canonicalStreamPartToAgUiEvent(part);
    if (event) state = adapter.applyEvent(state, event);
  }
  return state.parts;
}

export function uiPartsToCanonicalStreamParts(parts: UIPart[]): FluxyCanonicalStreamPart[] {
  const out: FluxyCanonicalStreamPart[] = [];
  for (const part of parts) {
    if (part.type === "text") {
      out.push({ type: "text-delta", delta: part.text });
      continue;
    }
    if (part.state === "call-available") {
      out.push({
        type: "tool-input-available",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        input: part.args,
      });
      continue;
    }
    if (part.state === "output-available") {
      out.push({
        type: "tool-output-available",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        output: part.output,
      });
      continue;
    }
    if (part.state === "output-error") {
      out.push({
        type: "tool-error",
        toolCallId: part.toolCallId,
        toolName: part.toolName,
        error: part.errorText ?? "tool_failed",
      });
    }
  }
  return out;
}

export function mergeCanonicalTextDeltas(parts: FluxyCanonicalStreamPart[]): FluxyCanonicalStreamPart[] {
  const merged: FluxyCanonicalStreamPart[] = [];
  for (const part of parts) {
    if (part.type !== "text-delta" || !part.delta) {
      merged.push(part);
      continue;
    }
    const prev = merged[merged.length - 1];
    if (prev?.type === "text-delta") {
      merged[merged.length - 1] = { ...prev, delta: prev.delta + part.delta };
    } else {
      merged.push({ ...part });
    }
  }
  return merged;
}

/** Convenience: fold canonical parts into a single assistant text + tool parts. */
export function canonicalStreamPartsToDisplay(parts: FluxyCanonicalStreamPart[]): {
  text: string;
  uiParts: UIPart[];
} {
  const uiParts = canonicalStreamPartsToUiParts(parts);
  const text = uiParts
    .filter((p): p is ReturnType<typeof createTextPart> => p.type === "text")
    .map((p) => p.text)
    .join("");
  return { text, uiParts };
}

export { createTextPart, createToolCallPart, createToolResultPart };
