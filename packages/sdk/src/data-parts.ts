/**
 * P24-5: Custom Types + Data Parts
 * Typed data stream parts for structured streaming.
 *
 * P24-6: useObject
 * Streaming structured objects from LLM with progressive parsing.
 */

export interface DataPart<T = unknown> {
  type: string;
  data: T;
  /** Position in the stream */
  index: number;
  /** Timestamp */
  timestamp: number;
}

export interface TextPart {
  type: "text";
  text: string;
  index: number;
  timestamp: number;
}

export interface ToolCallPart {
  type: "tool-call";
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  index: number;
  timestamp: number;
}

export interface ToolResultPart {
  type: "tool-result";
  toolCallId: string;
  result: unknown;
  success: boolean;
  index: number;
  timestamp: number;
}

export interface CustomDataPart<T = unknown> {
  type: string;
  data: T;
  index: number;
  timestamp: number;
}

export type StreamPart = TextPart | ToolCallPart | ToolResultPart | CustomDataPart;

/**
 * Parser for custom data parts.
 */
export interface DataPartParser<T = unknown> {
  type: string;
  parse: (raw: unknown) => T | null;
  serialize: (data: T) => unknown;
}

/**
 * Registry for custom data part parsers.
 */
export interface DataPartRegistry {
  /** Register a parser */
  register<T>(parser: DataPartParser<T>): void;
  /** Get a parser by type */
  get(type: string): DataPartParser | null;
  /** Parse a raw part */
  parse(type: string, raw: unknown): unknown | null;
  /** Serialize a part */
  serialize(type: string, data: unknown): unknown | null;
}

export function createDataPartRegistry(): DataPartRegistry {
  const parsers = new Map<string, DataPartParser>();
  return {
    register<T>(parser: DataPartParser<T>) {
      if (!parser.type.trim()) throw new TypeError("Data part parser type is required.");
      parsers.set(parser.type, parser as DataPartParser);
    },
    get: (type) => parsers.get(type) ?? null,
    parse(type, raw) {
      const parser = parsers.get(type);
      if (!parser) return null;
      try { return parser.parse(raw); } catch { return null; }
    },
    serialize(type, data) {
      const parser = parsers.get(type);
      if (!parser) return null;
      try { return parser.serialize(data); } catch { return null; }
    },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const BUILTIN_PARSERS: {
  text: DataPartParser<string>;
  "tool-call": DataPartParser<{ toolCallId: string; toolName: string; args: Record<string, unknown> }>;
  "tool-result": DataPartParser<{ toolCallId: string; result: unknown; success: boolean }>;
  json: DataPartParser<unknown>;
  image: DataPartParser<{ url: string; mimeType?: string; alt?: string }>;
} = {
  text: { type: "text", parse: (raw) => typeof raw === "string" ? raw : null, serialize: (data) => data },
  "tool-call": {
    type: "tool-call",
    parse: (raw) => record(raw) && typeof raw.toolCallId === "string" && typeof raw.toolName === "string" && record(raw.args)
      ? { toolCallId: raw.toolCallId, toolName: raw.toolName, args: raw.args }
      : null,
    serialize: (data) => data,
  },
  "tool-result": {
    type: "tool-result",
    parse: (raw) => record(raw) && typeof raw.toolCallId === "string" && typeof raw.success === "boolean"
      ? { toolCallId: raw.toolCallId, result: raw.result, success: raw.success }
      : null,
    serialize: (data) => data,
  },
  json: { type: "json", parse: (raw) => raw, serialize: (data) => data },
  image: {
    type: "image",
    parse: (raw) => record(raw) && typeof raw.url === "string"
      ? { url: raw.url, ...(typeof raw.mimeType === "string" ? { mimeType: raw.mimeType } : {}), ...(typeof raw.alt === "string" ? { alt: raw.alt } : {}) }
      : null,
    serialize: (data) => data,
  },
};

/**
 * useObject — streaming structured object from LLM.
 * Progressive JSON parsing with partial updates.
 */
export interface UseObjectOptions<T> {
  /** JSON schema for the expected object */
  schema: Record<string, unknown>;
  /** Initial value */
  initialValue?: T;
  /** Callback for partial updates */
  onPartial?: (partial: T) => void;
  /** Callback for completion */
  onComplete?: (final: T) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
}

export interface UseObjectResult<T> {
  /** Current partial object */
  object: T | null;
  /** Whether the stream is complete */
  isComplete: boolean;
  /** Whether an error occurred */
  error: Error | null;
  /** Send a prompt to generate the object */
  send: (prompt: string) => Promise<void>;
  /** Abort the current generation */
  abort: () => void;
}

export function useObject<T>(options: UseObjectOptions<T>): UseObjectResult<T> {
  throw new Error("useObject not implemented in SDK - use worker runtime");
}

/**
 * Parse a partial JSON string and return what can be parsed.
 */
export function parsePartialJSON<T>(partial: string): T | null {
  const source = partial.trim();
  if (!source) return null;
  try { return JSON.parse(source) as T; } catch { /* attempt conservative structural repair */ }

  let repaired = source;
  let inString = false;
  let escaped = false;
  const closers: string[] = [];
  for (const char of source) {
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") closers.push("}");
    else if (char === "[") closers.push("]");
    else if (char === "}" || char === "]") {
      if (closers[closers.length - 1] === char) closers.pop();
      else return null;
    }
  }
  if (inString) repaired += '"';
  repaired = repaired.replace(/[:,]\s*$/, "");
  repaired += closers.reverse().join("");
  try { return JSON.parse(repaired) as T; } catch { return null; }
}
