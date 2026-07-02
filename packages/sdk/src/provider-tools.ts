/**
 * P24-3: Provider-defined Tools
 * Provider supplies schema/description, developer provides execute function.
 * Also covers P24-3a: Provider-executed tools (server-side tools).
 */

export interface ProviderDefinedTool {
  /** Tool name (unique) */
  name: string;
  /** Tool description (provided by provider) */
  description: string;
  /** JSON Schema for input (provided by provider) */
  inputSchema: Record<string, unknown>;
  /** Execute function (provided by developer) */
  execute: (input: Record<string, unknown>, context: ProviderToolContext) => Promise<unknown>;
  /** Whether this tool is executed server-side by the provider */
  isServerExecuted?: boolean;
  /** Provider that supplies this tool */
  provider?: string;
  /** Tool category for UI grouping */
  category?: "search" | "code" | "data" | "media" | "custom";
  /** Whether this tool requires approval */
  requiresApproval?: boolean;
  /** Timeout in milliseconds */
  timeoutMs?: number;
}

export interface ProviderToolContext {
  userId: string;
  roomId: string;
  projectId: string;
  agentId: string;
  runId: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Metadata from the conversation */
  metadata?: Record<string, unknown>;
}

export interface ProviderToolSet {
  provider: string;
  tools: ProviderDefinedTool[];
}

/**
 * Registry for provider-defined tools.
 */
export interface ProviderToolRegistry {
  /** Register a tool set from a provider */
  register(toolSet: ProviderToolSet): void;
  /** Get all tools from all providers */
  getAllTools(): ProviderDefinedTool[];
  /** Get tools by provider */
  getByProvider(provider: string): ProviderDefinedTool[];
  /** Get a specific tool by name */
  get(name: string): ProviderDefinedTool | null;
  /** Check if a tool exists */
  has(name: string): boolean;
}

export declare function createProviderToolRegistry(): ProviderToolRegistry;

/**
 * Built-in provider tool sets.
 */
export declare const PROVIDER_TOOL_SETS: {
  webSearch: ProviderToolSet;
  codeExecution: ProviderToolSet;
  fileOperations: ProviderToolSet;
  dataAnalysis: ProviderToolSet;
};

/**
 * Convert provider-defined tools to FluxyChat tool schema format.
 */
export declare function providerToolsToSchema(tools: ProviderDefinedTool[]): Array<{
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
}>;
