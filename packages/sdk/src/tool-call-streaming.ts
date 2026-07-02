/**
 * P24-1: Tool Call Streaming
 * Stream partial tool inputs in real-time as model generates them.
 */

export interface ToolCallStreamChunk {
  type: "tool_call_start" | "tool_call_delta" | "tool_call_complete";
  toolCallId: string;
  toolName?: string;
  /** Partial arguments JSON string */
  delta?: string;
  /** Complete arguments object (only on complete) */
  args?: Record<string, unknown>;
}

export interface ToolCallStreamOptions {
  onChunk?: (chunk: ToolCallStreamChunk) => void | Promise<void>;
}

/**
 * Parse a tool call stream and emit progressive updates.
 * Yields chunks as the tool call is being generated.
 */
export async function* streamToolCalls(
  stream: AsyncGenerator<{ type: string; text?: string; toolCallId?: string; toolName?: string; delta?: string }>,
  options: ToolCallStreamOptions = {},
): AsyncGenerator<ToolCallStreamChunk> {
  const buffer = new Map(); // toolCallId -> accumulated args string
  const started = new Set();

  for await (const chunk of stream) {
    if (chunk.type === "tool_call_start" && chunk.toolCallId) {
      if (!started.has(chunk.toolCallId)) {
        started.add(chunk.toolCallId);
        buffer.set(chunk.toolCallId, "");
        const emit: ToolCallStreamChunk = {
          type: "tool_call_start",
          toolCallId: chunk.toolCallId,
          toolName: chunk.toolName,
        };
        yield emit;
        options.onChunk?.(emit);
      }
    } else if (chunk.type === "tool_call_delta" && chunk.toolCallId) {
      const existing = buffer.get(chunk.toolCallId) || "";
      const newArgs = existing + (chunk.delta || "");
      buffer.set(chunk.toolCallId, newArgs);
      const emit: ToolCallStreamChunk = {
        type: "tool_call_delta",
        toolCallId: chunk.toolCallId,
        delta: chunk.delta,
      };
      yield emit;
      options.onChunk?.(emit);
    } else if (chunk.type === "tool_call_complete" && chunk.toolCallId) {
      const argsStr = buffer.get(chunk.toolCallId) || "";
      let args;
      try {
        args = JSON.parse(argsStr);
      } catch {
        args = {};
      }
      buffer.delete(chunk.toolCallId);
      const emit: ToolCallStreamChunk = {
        type: "tool_call_complete",
        toolCallId: chunk.toolCallId,
        args,
      };
      yield emit;
      options.onChunk?.(emit);
    } else {
      // Pass through non-tool-call chunks
      yield chunk as unknown as ToolCallStreamChunk;
    }
  }
}
