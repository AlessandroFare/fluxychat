export interface McpServerConfig {
  name: string;
  url?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  headers?: Record<string, string>;
  transport?: "sse" | "stdio" | "streamable-http";
  oauth?: {
    clientId: string;
    clientSecret?: string;
    scopes?: string[];
    authorizationUrl?: string;
    tokenUrl?: string;
  };
  maxRetries?: number;
  timeoutMs?: number;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string; [key: string]: unknown }>;
  isError?: boolean;
}

export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
}

export interface McpClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<McpToolDefinition[]>;
  callTool(call: McpToolCall): Promise<McpToolResult>;
  listResources(): Promise<McpResource[]>;
  readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }>;
  isConnected(): boolean;
  getServerInfo(): { name: string; version: string };
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function mcpRequest(id: number, method: string, params?: unknown): JsonRpcRequest {
  return { jsonrpc: "2.0", id, method, params };
}

function createPendingMap() {
  let nextId = 1;
  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer?: ReturnType<typeof setTimeout> }>();
  return {
    nextId: () => nextId++,
    pending,
    cleanup(id: number) {
      const entry = pending.get(id);
      if (entry?.timer) clearTimeout(entry.timer);
      pending.delete(id);
    },
  };
}

export function mcpToolsToFluxyChat(tools: McpToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description ?? "",
      parameters: (t.inputSchema ?? {}) as Record<string, unknown>,
    },
  }));
}

export function fluxyChatResultToMcp(result: unknown): McpToolResult {
  const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
  return { content: [{ type: "text", text }], isError: false };
}

async function fetchWithTimeout(url: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const { timeoutMs, ...fetchInit } = init;
  if (!timeoutMs) return fetch(url, fetchInit);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ? anySignal([init.signal, controller.signal]) : controller.signal;
  try {
    return await fetch(url, { ...fetchInit, signal });
  } finally {
    clearTimeout(timer);
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) { controller.abort(signal.reason); return controller.signal; }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

interface OAuthTokenStore {
  getToken(serverUrl: string): Promise<{ accessToken: string; expiresAt?: number } | null>;
  setToken(serverUrl: string, token: { accessToken: string; expiresAt?: number }): Promise<void>;
}

const defaultTokenStore: OAuthTokenStore = {
  async getToken() { return null; },
  async setToken() {},
};

async function oauthFlow(config: McpServerConfig, serverUrl: string, store: OAuthTokenStore): Promise<string | null> {
  const oauth = config.oauth;
  if (!oauth) return null;
  const existing = await store.getToken(serverUrl);
  if (existing && (!existing.expiresAt || existing.expiresAt > Date.now())) {
    return existing.accessToken;
  }
  const authUrl = oauth.authorizationUrl || `${serverUrl.replace(/\/+$/, "")}/oauth/authorize`;
  const tokenUrl = oauth.tokenUrl || `${serverUrl.replace(/\/+$/, "")}/oauth/token`;
  const redirectUri = "http://localhost:port/callback";
  const state = Math.random().toString(36).slice(2);
  const codeVerifier = Math.random().toString(36).slice(2, 42);
  const codeChallenge = codeVerifier;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: oauth.clientId,
    redirect_uri: redirectUri,
    scope: (oauth.scopes ?? []).join(" "),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "plain",
  });
  const fullAuthUrl = `${authUrl}?${params}`;
  const code = await new Promise<string>((resolve, reject) => {
    const server = { close() {} };
    const timeout = setTimeout(() => { server.close(); reject(new Error("OAuth timeout")); }, 120_000);
    const handler = (req: { url?: string }) => {
      const url = new URL(req.url || "", "http://localhost");
      const authorizationCode = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      if (authorizationCode && returnedState === state) {
        clearTimeout(timeout);
        server.close();
        resolve(authorizationCode);
      }
    };
    (server as { close: () => void; handler?: (req: { url?: string }) => void }).handler = handler;
    reject(new Error("OAuth flow requires a browser redirect; implement a custom OAuth handler for production"));
  });
  const tokenResponse = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: oauth.clientId,
      ...(oauth.clientSecret ? { client_secret: oauth.clientSecret } : {}),
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenResponse.ok) throw new Error(`OAuth token exchange failed: ${tokenResponse.status}`);
  const tokenBody = await tokenResponse.json() as { access_token: string; expires_in?: number };
  const accessToken = tokenBody.access_token;
  const expiresAt = tokenBody.expires_in ? Date.now() + tokenBody.expires_in * 1000 : undefined;
  await store.setToken(serverUrl, { accessToken, expiresAt });
  return accessToken;
}

class HttpMcpClient implements McpClient {
  private config: McpServerConfig;
  private connected = false;
  private abortController?: AbortController;
  private serverInfo: { name: string; version: string } = { name: "", version: "" };
  private tokenStore: OAuthTokenStore;

  constructor(config: McpServerConfig, tokenStore?: OAuthTokenStore) {
    this.config = config;
    this.tokenStore = tokenStore ?? defaultTokenStore;
  }

  async connect(): Promise<void> {
    this.abortController = new AbortController();
    this.connected = true;
    this.serverInfo = { name: this.config.name, version: "1.0.0" };
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.abortController?.abort();
    this.abortController = undefined;
  }

  isConnected(): boolean { return this.connected; }
  getServerInfo(): { name: string; version: string } { return this.serverInfo; }

  private async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.connected) throw new Error("MCP client is not connected");
    const url = this.config.url;
    if (!url) throw new Error("MCP server URL not configured");
    const { nextId, pending, cleanup } = createPendingMap();
    const id = nextId();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };
    if (this.config.oauth) {
      const token = await oauthFlow(this.config, url, this.tokenStore);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const response = await fetchWithTimeout(url, {
        method: "POST",
        headers,
        body: JSON.stringify(mcpRequest(id, method, params)),
        timeoutMs: this.config.timeoutMs ?? 30_000,
        signal: this.abortController?.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`MCP request failed (${response.status}): ${text}`);
      }
      const json = await response.json() as JsonRpcResponse;
      if (json.error) throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
      return json.result;
    } finally {
      cleanup(id);
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    const result = await this.request("tools/list") as { tools?: McpToolDefinition[] };
    return (result?.tools ?? []).map((t: McpToolDefinition) => ({
      name: t.name,
      description: t.description ?? "",
      inputSchema: t.inputSchema ?? {},
    }));
  }

  async callTool(call: McpToolCall): Promise<McpToolResult> {
    const result = await this.request("tools/call", { name: call.name, arguments: call.arguments }) as McpToolResult;
    return {
      content: result?.content ?? [{ type: "text", text: "" }],
      isError: result?.isError ?? false,
    };
  }

  async listResources(): Promise<McpResource[]> {
    const result = await this.request("resources/list") as { resources?: McpResource[] };
    return (result?.resources ?? []).map((r: McpResource) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    }));
  }

  async readResource(uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }> {
    const result = await this.request("resources/read", { uri }) as { contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> };
    return { contents: result?.contents ?? [] };
  }
}

class SseMcpClient implements McpClient {
  private config: McpServerConfig;
  private connected = false;
  private abortController?: AbortController;
  private endpointUrl?: string;
  private serverInfo: { name: string; version: string } = { name: "", version: "" };
  private tokenStore: OAuthTokenStore;

  constructor(config: McpServerConfig, tokenStore?: OAuthTokenStore) {
    this.config = config;
    this.tokenStore = tokenStore ?? defaultTokenStore;
  }

  async connect(): Promise<void> {
    this.abortController = new AbortController();
    const url = this.config.url;
    if (!url) throw new Error("MCP server URL not configured");
    const headers: Record<string, string> = { Accept: "text/event-stream", ...this.config.headers };
    if (this.config.oauth) {
      const token = await oauthFlow(this.config, url, this.tokenStore);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch(url, { headers, signal: this.abortController.signal });
    if (!response.ok || !response.body) {
      throw new Error(`MCP SSE connect failed: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resolved = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (line.startsWith("event: endpoint")) {
          const dataLine = lines.find((l) => l.startsWith("data: "));
          if (dataLine) {
            this.endpointUrl = dataLine.slice(6).trim();
            this.connected = true;
            this.serverInfo = { name: this.config.name, version: "1.0.0" };
            resolved = true;
          }
        }
      }
      if (resolved) break;
    }
    if (!this.connected) throw new Error("MCP SSE: no endpoint received");
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.abortController?.abort();
    this.abortController = undefined;
  }

  isConnected(): boolean { return this.connected; }
  getServerInfo(): { name: string; version: string } { return this.serverInfo; }

  private async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.connected) throw new Error("MCP client is not connected");
    if (!this.endpointUrl) throw new Error("MCP SSE endpoint not available");
    const { nextId, pending, cleanup } = createPendingMap();
    const id = nextId();
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...this.config.headers,
    };
    if (this.config.oauth) {
      const token = await oauthFlow(this.config, this.endpointUrl, this.tokenStore);
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    try {
      const response = await fetchWithTimeout(this.endpointUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(mcpRequest(id, method, params)),
        timeoutMs: this.config.timeoutMs ?? 30_000,
        signal: this.abortController?.signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`MCP SSE request failed (${response.status}): ${text}`);
      }
      return null;
    } finally {
      cleanup(id);
    }
  }

  async listTools(): Promise<McpToolDefinition[]> {
    return [];
  }

  async callTool(_call: McpToolCall): Promise<McpToolResult> {
    throw new Error("Tool calls over SSE transport require a response channel; use streamable-http for bidirectional");
  }

  async listResources(): Promise<McpResource[]> {
    return [];
  }

  async readResource(_uri: string): Promise<{ contents: Array<{ uri: string; text?: string; blob?: string; mimeType?: string }> }> {
    return { contents: [] };
  }
}

export function createMcpClient(config: McpServerConfig, opts?: {
  maxRetries?: number;
  timeoutMs?: number;
  tokenStore?: OAuthTokenStore;
}): McpClient {
  const merged: McpServerConfig = {
    ...config,
    maxRetries: opts?.maxRetries ?? config.maxRetries ?? 0,
    timeoutMs: opts?.timeoutMs ?? config.timeoutMs ?? 30_000,
  };
  if (merged.transport === "sse") return new SseMcpClient(merged, opts?.tokenStore);
  return new HttpMcpClient(merged, opts?.tokenStore);
}

export interface McpRegistry {
  register(config: McpServerConfig): void;
  connectAll(): Promise<void>;
  disconnectAll(): Promise<void>;
  getAllTools(): Promise<McpToolDefinition[]>;
  callTool(call: McpToolCall): Promise<McpToolResult>;
  getStatus(): Array<{ name: string; connected: boolean; toolCount: number }>;
}

export function createMcpRegistry(): McpRegistry {
  const clients = new Map<string, { config: McpServerConfig; client: McpClient }>();

  return {
    register(config: McpServerConfig): void {
      if (clients.has(config.name)) {
        throw new Error(`MCP server "${config.name}" is already registered`);
      }
      const client = createMcpClient(config);
      clients.set(config.name, { config, client });
    },
    async connectAll(): Promise<void> {
      const errors: Array<{ name: string; error: Error }> = [];
      await Promise.all([...clients.entries()].map(async ([name, entry]) => {
        try { await entry.client.connect(); } catch (e) { errors.push({ name, error: e instanceof Error ? e : new Error(String(e)) }); }
      }));
      if (errors.length > 0) {
        const messages = errors.map((e) => `${e.name}: ${e.error.message}`).join("; ");
        throw new Error(`MCP connection errors: ${messages}`);
      }
    },
    async disconnectAll(): Promise<void> {
      await Promise.all([...clients.values()].map((entry) => entry.client.disconnect().catch(() => {})));
    },
    async getAllTools(): Promise<McpToolDefinition[]> {
      const results = await Promise.all([...clients.values()].map(async (entry) => {
        try { return await entry.client.listTools(); } catch { return [] as McpToolDefinition[]; }
      }));
      return results.flat();
    },
    async callTool(call: McpToolCall): Promise<McpToolResult> {
      for (const [, entry] of clients) {
        try {
          const tools = await entry.client.listTools();
          if (tools.some((t) => t.name === call.name)) {
            return entry.client.callTool(call);
          }
        } catch {}
      }
      return { content: [{ type: "text", text: `Tool "${call.name}" not found on any MCP server` }], isError: true };
    },
    getStatus(): Array<{ name: string; connected: boolean; toolCount: number }> {
      return [...clients.entries()].map(([name, entry]) => ({
        name,
        connected: entry.client.isConnected(),
        toolCount: entry.client.isConnected() ? 0 : 0,
      }));
    },
  };
}
