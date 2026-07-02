/**
 * P23-6a: Typed Runtime Context
 * Adapted from Vercel Chat SDK's runtimeContext with schema validation.
 *
 * Shared typed context across agent steps, tools, and calls.
 *
 * Usage:
 *   const context = createRuntimeContext({
 *     userId: "user-123",
 *     roomId: "room-456",
 *     projectId: "project-789",
 *   });
 *
 *   // In agent step
 *   const userId = context.get("userId");
 *
 *   // In tool call
 *   context.set("toolResult", result);
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} RuntimeContextSchema
 * @property {Record<string, { type: string, required?: boolean, default?: any }>} [fields] - Schema fields
 */

/**
 * @typedef {Object} RuntimeContextOptions
 * @property {RuntimeContextSchema} [schema] - Schema for validation
 * @property {boolean} [strict] - Throw on invalid access (default: false)
 */

// =============================================================================
// Runtime Context
// =============================================================================

/**
 * Create a typed runtime context for sharing data across agent steps.
 * @template T extends Record<string, any>
 * @param {T} initialData - Initial context data
 * @param {RuntimeContextOptions} [options] - Context options
 * @returns {T & { get: <K extends keyof T>(key: K) => T[K], set: <K extends keyof T>(key: K, value: T[K]) => void, getAll: () => T, has: (key: string) => boolean, delete: (key: string) => boolean, clear: () => void, validate: () => string[] }}
 */
export function createRuntimeContext(initialData = {}, options = {}) {
  const { schema, strict = false } = options;

  /** @type {Map<string, any>} */
  const data = new Map(Object.entries(initialData));

  /**
   * Validate a value against schema.
   * @param {string} key
   * @param {any} value
   * @returns {string|null} Error message or null
   */
  function validateValue(key, value) {
    if (!schema?.fields?.[key]) return null;

    const fieldSchema = schema.fields[key];
    const errors = [];

    if (fieldSchema.required && (value === undefined || value === null)) {
      errors.push(`${key} is required`);
    }

    if (value !== undefined && value !== null && fieldSchema.type) {
      const actualType = typeof value;
      if (actualType !== fieldSchema.type) {
        errors.push(`${key} must be of type ${fieldSchema.type}, got ${actualType}`);
      }
    }

    return errors.length > 0 ? errors.join(", ") : null;
  }

  const context = {
    /**
     * Get a value from the context.
     * @template K extends keyof T
     * @param {K} key
     * @returns {T[K]}
     */
    get(key) {
      if (!data.has(key) && schema?.fields?.[key]?.default !== undefined) {
        return schema.fields[key].default;
      }
      return data.get(key);
    },

    /**
     * Set a value in the context.
     * @template K extends keyof T
     * @param {K} key
     * @param {T[K]} value
     */
    set(key, value) {
      const error = validateValue(key, value);
      if (error && strict) {
        throw new Error(`RuntimeContext validation error: ${error}`);
      }
      data.set(key, value);
    },

    /**
     * Get all context data.
     * @returns {T}
     */
    getAll() {
      return Object.fromEntries(data) as T;
    },

    /**
     * Check if a key exists.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
      return data.has(key);
    },

    /**
     * Delete a key from context.
     * @param {string} key
     * @returns {boolean}
     */
    delete(key) {
      return data.delete(key);
    },

    /**
     * Clear all context data.
     */
    clear() {
      data.clear();
    },

    /**
     * Validate all context data against schema.
     * @returns {string[]} Array of error messages
     */
    validate() {
      if (!schema?.fields) return [];

      const errors = [];
      for (const [key, fieldSchema] of Object.entries(schema.fields)) {
        const value = data.get(key);
        const error = validateValue(key, value);
        if (error) {
          errors.push(error);
        }
      }
      return errors;
    },
  };

  return context as T & typeof context;
}

// =============================================================================
// Predefined Schemas
// =============================================================================

/**
 * Schema for agent runtime context.
 */
export const AGENT_RUNTIME_SCHEMA = {
  fields: {
    userId: { type: "string", required: true },
    roomId: { type: "string", required: true },
    projectId: { type: "string", required: true },
    agentId: { type: "string" },
    agentName: { type: "string" },
    model: { type: "string" },
    provider: { type: "string" },
    traceId: { type: "string" },
    parentId: { type: "string" },
  },
};

/**
 * Schema for tool execution context.
 */
export const TOOL_EXECUTION_SCHEMA = {
  fields: {
    toolName: { type: "string", required: true },
    toolCallId: { type: "string", required: true },
    arguments: { type: "object" },
    result: {},
    error: { type: "string" },
    startTime: { type: "number" },
    endTime: { type: "number" },
    duration: { type: "number" },
  },
};

/**
 * Schema for message context.
 */
export const MESSAGE_CONTEXT_SCHEMA = {
  fields: {
    messageId: { type: "string", required: true },
    content: { type: "string", required: true },
    role: { type: "string" },
    userId: { type: "string" },
    roomId: { type: "string" },
    timestamp: { type: "number" },
    parentId: { type: "string" },
    mentions: { type: "object" },
    attachments: { type: "object" },
  },
};

// =============================================================================
// Context Propagation
// =============================================================================

/**
 * Create a child context that inherits from a parent.
 * @template T
 * @param {T} parent - Parent context
 * @param {Partial<T>} overrides - Values to override
 * @returns {T}
 */
export function createChildContext(parent, overrides = {}) {
  const parentData = parent.getAll ? parent.getAll() : parent;
  return createRuntimeContext({ ...parentData, ...overrides });
}

/**
 * Wrap a function with context propagation.
 * @template T, R
 * @param {T} context - Runtime context
 * @param {(ctx: T) => Promise<R>} fn - Function to wrap
 * @returns {Promise<R>}
 */
export async function withContext(context, fn) {
  return fn(context);
}

/**
 * Create a context storage for async context propagation (similar to AsyncLocalStorage).
 */
export function createContextStorage() {
  /** @type {Map<string, any>} */
  const contexts = new Map();

  return {
    /**
     * Run a function with a context.
     * @param {string} key - Context key
     * @param {any} context - Context value
     * @param {() => Promise<T>} fn - Function to run
     * @returns {Promise<T>}
     */
    async run(key, context, fn) {
      contexts.set(key, context);
      try {
        return await fn();
      } finally {
        contexts.delete(key);
      }
    },

    /**
     * Get the current context.
     * @param {string} key - Context key
     * @returns {any}
     */
    get(key) {
      return contexts.get(key);
    },

    /**
     * Check if a context exists.
     * @param {string} key - Context key
     * @returns {boolean}
     */
    has(key) {
      return contexts.has(key);
    },
  };
}
