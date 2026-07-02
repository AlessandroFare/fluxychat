/**
 * P23-10: Scoped Tool Context
 * Per-tool secret/config isolation. Each tool gets only the context it needs.
 */

export interface ToolContext {
  projectId: string;
  userId: string;
  roomId: string;
  agentId: string;
  [key: string]: unknown;
}

export interface ScopedToolContext extends ToolContext {
  /** Secrets/credentials scoped to this specific tool */
  secrets: Record<string, string>;
  /** Config values scoped to this specific tool */
  config: Record<string, unknown>;
}

export interface ToolContextScope {
  /** Tool name this scope applies to */
  toolName: string;
  /** Secrets to inject (keys are secret names, values are the actual secrets) */
  secrets?: Record<string, string>;
  /** Config to inject */
  config?: Record<string, unknown>;
}

export interface ToolContextManager {
  /** Register a scope for a specific tool */
  registerScope(scope: ToolContextScope): void;
  /** Get the scoped context for a specific tool */
  getScopedContext(toolName: string, baseContext: ToolContext): ScopedToolContext;
  /** Get all registered scopes */
  getScopes(): ToolContextScope[];
}

export declare function createToolContextManager(): ToolContextManager;
export declare function createScopedToolContext(
  toolName: string,
  baseContext: ToolContext,
  scope?: ToolContextScope,
): ScopedToolContext;
