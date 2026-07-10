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
  throw new Error("not implemented in SDK - use worker runtime");
}

/**
 * Built-in data part parsers.
 */
export const BUILTIN_PARSERS: {
  text: DataPartParser<string>;
  "tool-call": DataPartParser<{ toolCallId: string; toolName: string; args: Record<string, unknown> }>;
  "tool-result": DataPartParser<{ toolCallId: string; result: unknown; success: boolean }>;
  json: DataPartParser<unknown>;
  image: DataPartParser<{ url: string; mimeType?: string; alt?: string }>;
} = {} as any;

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
  throw new Error("parsePartialJSON not implemented in SDK - use worker runtime");
}
