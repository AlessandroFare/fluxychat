import {
  createTextPart,
  createToolCallPart,
  createToolResultPart,
  type TextUIPart,
  type ToolCallUIPart,
  type ToolResultUIPart,
  type UIPart,
} from "./generative-ui";

/** AG-UI / agent stream events (subset + passthrough for unknown types). */
export interface AgUiStreamEvent {
  type: string;
  [key: string]: unknown;
}

export interface AgUiRunState {
  runId: string;
  parts: UIPart[];
  /** Raw events not mapped to UIPart (preserved for replay / forward compatibility). */
  unknownEvents: AgUiStreamEvent[];
}

export interface AgUiAdapterOptions {
  onUnknownEvent?: (event: AgUiStreamEvent) => void;
}

export interface AgUiAdapter {
  createRun(runId: string): AgUiRunState;
  applyEvent(state: AgUiRunState, event: AgUiStreamEvent): AgUiRunState;
  partsToEvents(parts: UIPart[]): AgUiStreamEvent[];
}

export function createAgUiAdapter(options: AgUiAdapterOptions = {}): AgUiAdapter {
  return {
    createRun(runId) {
      return { runId, parts: [], unknownEvents: [] };
    },

    applyEvent(state, event) {
      const next: AgUiRunState = {
        runId: state.runId,
        parts: [...state.parts],
        unknownEvents: [...state.unknownEvents],
      };

      switch (event.type) {
        case "text_delta":
        case "TEXT_MESSAGE_CONTENT": {
          const delta = String(event.delta ?? event.content ?? "");
          if (!delta) return next;
          const last = next.parts[next.parts.length - 1];
          if (last && last.type === "text") {
            next.parts[next.parts.length - 1] = createTextPart(last.text + delta);
          } else {
            next.parts.push(createTextPart(delta));
          }
          return next;
        }

        case "tool_call":
        case "TOOL_CALL_START": {
          const toolName = String(event.toolName ?? event.name ?? "tool");
          const toolCallId = String(event.toolCallId ?? event.id ?? crypto.randomUUID());
          const args =
            typeof event.args === "object" && event.args !== null
              ? (event.args as Record<string, unknown>)
              : {};
          next.parts.push(createToolCallPart(toolName, toolCallId, args));
          return next;
        }

        case "tool_result":
        case "TOOL_CALL_RESULT": {
          const toolName = String(event.toolName ?? event.name ?? "tool");
          const toolCallId = String(event.toolCallId ?? event.id ?? "");
          const failed = event.ok === false || event.error != null;
          next.parts.push(
            createToolResultPart(
              toolName,
              toolCallId,
              failed ? "output-error" : "output-available",
              event.output ?? event.result,
              failed ? String(event.error ?? "tool_failed") : undefined,
            ),
          );
          return next;
        }

        case "run_finished":
        case "RUN_FINISHED":
          return next;

        default:
          next.unknownEvents.push(event);
          options.onUnknownEvent?.(event);
          return next;
      }
    },

    partsToEvents(parts) {
      const events: AgUiStreamEvent[] = [];
      for (const part of parts) {
        if (part.type === "text") {
          events.push({ type: "text_delta", delta: part.text });
          continue;
        }
        if (part.state === "call-available") {
          const call = part as ToolCallUIPart;
          events.push({
            type: "tool_call",
            toolName: call.toolName,
            toolCallId: call.toolCallId,
            args: call.args,
          });
          continue;
        }
        const result = part as ToolResultUIPart;
        events.push({
          type: "tool_result",
          toolName: result.toolName,
          toolCallId: result.toolCallId,
          ok: result.state !== "output-error",
          output: result.output,
          error: result.errorText,
        });
      }
      return events;
    },
  };
}

export function mergeAgUiTextParts(parts: UIPart[]): UIPart[] {
  const merged: UIPart[] = [];
  for (const part of parts) {
    if (part.type === "text" && merged.length > 0 && merged[merged.length - 1].type === "text") {
      const prev = merged[merged.length - 1] as TextUIPart;
      merged[merged.length - 1] = createTextPart(prev.text + part.text);
    } else {
      merged.push(part);
    }
  }
  return merged;
}
