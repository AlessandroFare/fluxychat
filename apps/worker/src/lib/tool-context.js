/**
 * P23-10: Scoped Tool Context — Worker Implementation
 * Per-tool secret/config isolation.
 */

/**
 * Create a tool context manager for registering and resolving scoped contexts.
 */
export function createToolContextManager() {
  const scopes = new Map();

  return {
    registerScope(scope) {
      scopes.set(scope.toolName, scope);
    },

    getScopedContext(toolName, baseContext) {
      const scope = scopes.get(toolName) || {};
      return {
        ...baseContext,
        secrets: { ...(scope.secrets || {}) },
        config: { ...(scope.config || {}) },
      };
    },

    getScopes() {
      return Array.from(scopes.values());
    },
  };
}

/**
 * Create a scoped tool context for a specific tool.
 * @param {string} toolName
 * @param {Object} baseContext - Base context (projectId, userId, roomId, etc.)
 * @param {Object} [scope] - Optional scope with secrets/config
 */
export function createScopedToolContext(toolName, baseContext, scope = {}) {
  return {
    ...baseContext,
    secrets: { ...(scope.secrets || {}) },
    config: { ...(scope.config || {}) },
    _toolName: toolName,
  };
}

/**
 * Create a middleware that injects scoped contexts into tool calls.
 * @param {Object} contextManager - Tool context manager instance
 * @param {Object} baseContext - Base context for all tools
 */
export function createScopedContextMiddleware(contextManager, baseContext) {
  return {
    name: "scoped-context",
    async wrapGenerate(params, next) {
      // Inject scoped contexts into tool definitions
      if (params.tools) {
        params = {
          ...params,
          tools: params.tools.map((tool) => {
            const scoped = contextManager.getScopedContext(tool.name, baseContext);
            return { ...tool, context: scoped };
          }),
        };
      }
      return next();
    },
  };
}
