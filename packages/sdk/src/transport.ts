/**
 * P24-4: Transport Architecture
 * Pluggable transport layer for LLM communication.
 */

export type TransportType = "http" | "sse" | "websocket" | "grpc";

export interface TransportConfig {
  type: TransportType;
  /** Base URL for the transport */
  baseUrl: string;
  /** API key */
  apiKey?: string;
  /** Headers to include */
  headers?: Record<string, string>;
  /** Timeout in milliseconds */
  timeoutMs?: number;
  /** Maximum retries */
  maxRetries?: number;
  /** Whether to use keep-alive */
  keepAlive?: boolean;
}

export interface TransportRequest {
  method: string;
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export interface TransportResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
  /** For SSE: async iterable of events */
  stream?: AsyncIterable<unknown>;
}

export interface Transport {
  type: TransportType;
  /** Send a request */
  send(request: TransportRequest): Promise<TransportResponse>;
  /** Send a streaming request */
  stream(request: TransportRequest): AsyncIterable<unknown>;
  /** Check if transport is healthy */
  healthCheck(): Promise<boolean>;
  /** Close the transport */
  close(): Promise<void>;
}

export interface TransportFactory {
  create(config: TransportConfig): Transport;
}

/**
 * HTTP transport using fetch.
 */
export function createHTTPTransport(config: TransportConfig): Transport {
  throw new Error("createHTTPTransport not implemented in SDK - use worker runtime");
}

/**
 * SSE transport for streaming responses.
 */
export function createSSETransport(config: TransportConfig): Transport {
  throw new Error("createSSETransport not implemented in SDK - use worker runtime");
}

/**
 * WebSocket transport for bidirectional communication.
 */
export function createWebSocketTransport(config: TransportConfig): Transport {
  throw new Error("createWebSocketTransport not implemented in SDK - use worker runtime");
}

/**
 * Transport registry — manages multiple transports with fallback.
 */
export interface TransportRegistry {
  /** Register a transport */
  register(name: string, transport: Transport): void;
  /** Get a transport by name */
  get(name: string): Transport | null;
  /** Get the default transport */
  getDefault(): Transport | null;
  /** Set the default transport */
  setDefault(name: string): void;
  /** List all registered transports */
  list(): Array<{ name: string; type: TransportType; healthy: boolean }>;
}

export function createTransportRegistry(): TransportRegistry {
  throw new Error("createTransportRegistry not implemented in SDK - use worker runtime");
}
