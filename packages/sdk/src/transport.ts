const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;

export type TransportType = "http" | "sse" | "websocket" | "webtransport" | "long-poll" | "grpc";

export interface TransportConfig {
  type: TransportType;
  baseUrl: string;
  apiKey?: string;
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxRetries?: number;
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
  stream?: AsyncIterable<unknown>;
}

export interface Transport {
  type: TransportType;
  send(request: TransportRequest): Promise<TransportResponse>;
  stream(request: TransportRequest): AsyncIterable<unknown>;
  healthCheck(): Promise<boolean>;
  close(): Promise<void>;
}

export interface TransportFactory {
  create(config: TransportConfig): Transport;
}

function urlFor(baseUrl: string, path: string): string {
  return new URL(path, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`).toString();
}

function headersFor(config: TransportConfig, request: TransportRequest): Headers {
  const headers = new Headers(config.headers);
  for (const [key, value] of Object.entries(request.headers ?? {})) headers.set(key, value);
  if (config.apiKey && !headers.has("authorization")) headers.set("authorization", `Bearer ${config.apiKey}`);
  if (request.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
  return headers;
}

function mergeAbortSignals(signal: AbortSignal | undefined, timeoutMs: number): { signal: AbortSignal; dispose: () => void } {
  const controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(new DOMException("Transport request timed out", "TimeoutError")), timeoutMs);
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
    },
  };
}

function responseHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(headers.entries());
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("json")) return response.json();
  return response.text();
}

async function* decodeLines(body: ReadableStream<Uint8Array>, signal?: AbortSignal): AsyncIterable<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason;
      const { done, value } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split(/\r?\n/);
      buffered = lines.pop() ?? "";
      for (const line of lines) yield line;
      if (done) break;
    }
    if (buffered) yield buffered;
  } finally {
    reader.releaseLock();
  }
}

async function* decodeEventStream(response: Response, signal?: AbortSignal): AsyncIterable<unknown> {
  if (!response.body) return;
  const isSse = (response.headers.get("content-type") ?? "").includes("text/event-stream");
  let data: string[] = [];
  for await (const line of decodeLines(response.body, signal)) {
    if (isSse && line.startsWith(":")) continue;
    if (isSse && line === "") {
      if (data.length) {
        const value = data.join("\n");
        data = [];
        yield parseStreamValue(value);
      }
      continue;
    }
    if (isSse) {
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    } else if (line.trim()) {
      yield parseStreamValue(line);
    }
  }
  if (data.length) yield parseStreamValue(data.join("\n"));
}

function parseStreamValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function createFetchTransport(config: TransportConfig, type: "http" | "sse" | "long-poll"): Transport {
  let closed = false;
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;

  async function fetchWithRetry(request: TransportRequest, accept?: string): Promise<Response> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (closed) throw new Error("Transport is closed.");
      const merged = mergeAbortSignals(request.signal, timeoutMs);
      try {
        const headers = headersFor(config, request);
        if (accept) headers.set("accept", accept);
        const response = await fetch(urlFor(config.baseUrl, request.path), {
          method: request.method,
          headers,
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          signal: merged.signal,
          keepalive: config.keepAlive,
        });
        if (response.status < 500 || attempt === maxRetries) return response;
        await response.body?.cancel();
        lastError = new Error(`Transport returned ${response.status}.`);
      } catch (error) {
        if (request.signal?.aborted) throw request.signal.reason;
        lastError = error;
        if (attempt === maxRetries) throw error;
      } finally {
        merged.dispose();
      }
      await new Promise((resolve) => setTimeout(resolve, Math.min(100 * 2 ** attempt, 1_000)));
    }
    throw lastError;
  }

  return {
    type,
    async send(request) {
      const response = await fetchWithRetry(request);
      return {
        status: response.status,
        headers: responseHeaders(response.headers),
        body: await parseResponseBody(response),
      };
    },
    async *stream(request) {
      const accept = type === "sse" ? "text/event-stream" : "application/x-ndjson, application/json";
      const response = await fetchWithRetry(request, accept);
      if (!response.ok) throw new Error(`Transport stream returned ${response.status}.`);
      yield* decodeEventStream(response, request.signal);
    },
    async healthCheck() {
      try {
        const response = await fetchWithRetry({ method: "HEAD", path: "/health" });
        await response.body?.cancel();
        return response.ok;
      } catch {
        return false;
      }
    },
    async close() {
      closed = true;
    },
  };
}

export function createHTTPTransport(config: TransportConfig): Transport {
  return createFetchTransport({ ...config, type: "http" }, "http");
}

export function createSSETransport(config: TransportConfig): Transport {
  return createFetchTransport({ ...config, type: "sse" }, "sse");
}

export function createLongPollTransport(config: TransportConfig): Transport {
  return createFetchTransport({ ...config, type: "long-poll" }, "long-poll");
}

export function createWebSocketTransport(config: TransportConfig): Transport {
  const fallback = createHTTPTransport(config);
  return { ...fallback, type: "websocket" };
}

export function createWebTransportTransport(config: TransportConfig): Transport {
  const fallback = createHTTPTransport(config);
  return { ...fallback, type: "webtransport" };
}

export interface TransportRegistry {
  register(name: string, transport: Transport): void;
  unregister(name: string): Promise<void>;
  get(name: string): Transport | null;
  getDefault(): Transport | null;
  setDefault(name: string): void;
  selectHealthy(preferred?: readonly string[]): Promise<Transport | null>;
  list(): Array<{ name: string; type: TransportType; healthy: boolean | null }>;
  close(): Promise<void>;
}

export function createTransportRegistry(): TransportRegistry {
  const transports = new Map<string, Transport>();
  const health = new Map<string, boolean>();
  let defaultName: string | null = null;

  return {
    register(name, transport) {
      if (!name.trim()) throw new TypeError("Transport name is required.");
      transports.set(name, transport);
      health.delete(name);
      defaultName ??= name;
    },
    async unregister(name) {
      const transport = transports.get(name);
      if (transport) await transport.close();
      transports.delete(name);
      health.delete(name);
      if (defaultName === name) defaultName = transports.keys().next().value ?? null;
    },
    get: (name) => transports.get(name) ?? null,
    getDefault: () => (defaultName ? transports.get(defaultName) ?? null : null),
    setDefault(name) {
      if (!transports.has(name)) throw new Error(`Unknown transport: ${name}`);
      defaultName = name;
    },
    async selectHealthy(preferred = []) {
      const names = [...preferred, ...transports.keys()].filter((name, index, all) => all.indexOf(name) === index);
      for (const name of names) {
        const transport = transports.get(name);
        if (!transport) continue;
        const healthy = await transport.healthCheck();
        health.set(name, healthy);
        if (healthy) return transport;
      }
      return null;
    },
    list: () => [...transports].map(([name, transport]) => ({ name, type: transport.type, healthy: health.get(name) ?? null })),
    async close() {
      await Promise.all([...transports.values()].map((transport) => transport.close()));
      transports.clear();
      health.clear();
      defaultName = null;
    },
  };
}
