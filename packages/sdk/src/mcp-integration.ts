/**
 * P23-3: MCP Integration
 * MCP client that converts MCP tools to FluxyChat tool format.
 */

export interface McpServerConfig {
  /** Server name */
  name: string;
  /** Server URL (for HTTP/SSE transport) */
  url?: string;
  /** Command to run (for stdio transport) */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** Environment variables for stdio transport */
  env?: Record<string, string>;
  /** HTTP headers for SSE transport */
  headers?: Record<string, string>;
  /** Transport type */
  transport?: "sse" | "stdio" | "streamable-http";
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

export interface McpClient {
  /** Connect to the MCP server */
  connect(): Promise<void>;
  /** Disconnect from the MCP server */
  disconnect(): Promise<void>;
  /** List available tools */
  listTools(): Promise<McpToolDefinition[]>;
  /** Call a tool */
  callTool(call: McpToolCall): Promise<McpToolResult>;
  /** Check if connected */
  isConnected(): boolean;
}

/**
 * Convert MCP tool definitions to FluxyChat tool format.
 */
export function mcpToolsToFluxyChat(tools: McpToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}> {
  throw new Error("mcpToolsToFluxyChat not implemented in SDK - use worker runtime");
}

/**
 * Convert FluxyChat tool result to MCP format.
 */
export function fluxyChatResultToMcp(result: unknown): McpToolResult {
  throw new Error("fluxyChatResultToMcp not implemented in SDK - use worker runtime");
}

/**
 * Create an MCP client with retry logic.
 */
export function createMcpClient(config: McpServerConfig, opts?: {
  maxRetries?: number;
  timeoutMs?: number;
}): McpClient {
  throw new Error("createMcpClient not implemented in SDK - use worker runtime");
}

/**
 * MCP tool registry — manages multiple MCP servers.
 */
export interface McpRegistry {
  /** Register an MCP server */
  register(config: McpServerConfig): void;
  /** Connect all registered servers */
  connectAll(): Promise<void>;
  /** Disconnect all servers */
  disconnectAll(): Promise<void>;
  /** Get all tools from all connected servers */
  getAllTools(): Promise<McpToolDefinition[]>;
  /** Call a tool, routing to the correct server */
  callTool(call: McpToolCall): Promise<McpToolResult>;
  /** Get server status */
  getStatus(): Array<{ name: string; connected: boolean; toolCount: number }>;
}

export function createMcpRegistry(): McpRegistry {
  throw new Error("createMcpRegistry not implemented in SDK - use worker runtime");
}
