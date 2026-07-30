export type StreamChunkType = "text" | "tool-call" | "tool-result" | "error" | "done";

export interface StreamChunk {
  type: StreamChunkType;
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  error?: string;
}

export function createStreamChunk(type: StreamChunkType, data?: Partial<StreamChunk>): StreamChunk {
  return { type, ...data };
}

export function isTextChunk(chunk: StreamChunk): chunk is StreamChunk & { content: string } {
  return chunk.type === "text" && typeof chunk.content === "string";
}

export function isToolCallChunk(chunk: StreamChunk): chunk is StreamChunk & { toolName: string } {
  return chunk.type === "tool-call";
}

export function isToolResultChunk(chunk: StreamChunk): chunk is StreamChunk & { toolResult: string } {
  return chunk.type === "tool-result";
}

export function parseStreamChunks(input: string): StreamChunk[] {
  const chunks: StreamChunk[] = [];
  const lines = input.split("\n");
  for (const line of lines) {
    if (line.startsWith("0:")) {
      chunks.push({ type: "text", content: line.slice(2) });
    } else if (line.startsWith("8:")) {
      const parsed = tryParseJson(line.slice(2));
      if (parsed) {
        chunks.push({ type: "tool-call", toolName: parsed.toolName, toolArgs: JSON.stringify(parsed.args) });
      }
    } else if (line.startsWith("9:")) {
      chunks.push({ type: "tool-result", toolResult: line.slice(2) });
    } else if (line.startsWith("3:")) {
      chunks.push({ type: "error", error: line.slice(2) });
    }
  }
  return chunks;
}

function tryParseJson(s: string): any {
  try { return JSON.parse(s); } catch { return null; }
}

export function serializeStreamChunks(chunks: StreamChunk[]): string {
  return chunks.map((c) => {
    switch (c.type) {
      case "text": return `0:${c.content ?? ""}`;
      case "tool-call": return `8:${JSON.stringify({ toolName: c.toolName, args: c.toolArgs ? tryParseJson(c.toolArgs) : {} })}`;
      case "tool-result": return `9:${c.toolResult ?? ""}`;
      case "error": return `3:${c.error ?? ""}`;
      case "done": return "";
      default: return "";
    }
  }).filter(Boolean).join("\n");
}

export function healMarkdown(input: string): string {
  let out = input;
  const fences = out.match(/```/g);
  if (fences && fences.length % 2 !== 0) out += "\n```";
  return out;
}

export function bufferTableCells(input: string): string {
  const lines = input.split("\n");
  let inTable = false;
  const result: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.includes("|")) {
      const cells = trimmed.split("|").filter(Boolean);
      if (cells.length >= 2) {
        if (!inTable) {
          inTable = true;
          result.push(line);
          const sep = cells.map(() => "---").join(" | ");
          result.push(`| ${sep} |`);
          continue;
        }
        result.push(line);
        continue;
      }
    }
    inTable = false;
    result.push(line);
  }

  return result.join("\n");
}
