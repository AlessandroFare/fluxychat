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
export declare function mcpToolsToFluxyChat(tools: McpToolDefinition[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}>;

/**
 * Convert FluxyChat tool result to MCP format.
 */
export declare function fluxyChatResultToMcp(result: unknown): McpToolResult;

/**
 * Create an MCP client with retry logic.
 */
export declare function createMcpClient(config: McpServerConfig, opts?: {
  maxRetries?: number;
  timeoutMs?: number;
}): McpClient;

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

export declare function createMcpRegistry(): McpRegistry;
