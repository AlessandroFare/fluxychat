export interface AgentToolCallDisplay {
  id: string;
  name: string;
  arguments: string;
  resultPreview?: string | null;
  success?: boolean;
}

export interface AgentRunDisplay {
  id: string;
  status: string;
  latency_ms?: number;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  error?: string | null;
  room_id?: string | null;
  iterations?: number;
  tool_calls?: AgentToolCallDisplay[];
  created_at?: string;
}

export function parseToolCallsJson(raw: unknown): AgentToolCallDisplay[] {
  if (!raw) return [];
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out: AgentToolCallDisplay[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const name = typeof row.name === "string" ? row.name : "tool";
    const id = typeof row.id === "string" ? row.id : name;
    const args =
      typeof row.arguments === "string"
        ? row.arguments
        : JSON.stringify(row.arguments ?? {});
    const resultPreview =
      row.result != null
        ? truncate(JSON.stringify(row.result), 120)
        : typeof row.error === "string"
          ? row.error
          : null;
    const success =
      row.success === true || (row.error == null && row.result != null)
        ? true
        : row.success === false || row.error
          ? false
          : undefined;
    out.push({ id, name, arguments: args, resultPreview, success });
  }
  return out;
}

export function normalizeAgentRun(row: Record<string, unknown>): AgentRunDisplay {
  const toolCalls = parseToolCallsJson(
    row.tool_calls ?? row.tool_calls_json ?? row.toolCalls,
  );
  return {
    id: String(row.id ?? ""),
    status: String(row.status ?? "unknown"),
    latency_ms: numberOrUndefined(row.latency_ms ?? row.latencyMs),
    input_tokens: numberOrUndefined(row.input_tokens ?? row.inputTokens),
    output_tokens: numberOrUndefined(row.output_tokens ?? row.outputTokens),
    estimated_cost: numberOrUndefined(row.estimated_cost ?? row.estimatedCost),
    error: row.error != null ? String(row.error) : null,
    room_id: row.room_id != null ? String(row.room_id) : null,
    iterations: numberOrUndefined(row.iterations),
    tool_calls: toolCalls,
    created_at: row.created_at != null ? String(row.created_at) : undefined,
  };
}

function numberOrUndefined(value: unknown): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

export function runStatusLabel(status: string): string {
  if (status === "completed") return "Completed";
  if (status === "failed") return "Failed";
  if (status === "queued") return "Queued";
  return status;
}
