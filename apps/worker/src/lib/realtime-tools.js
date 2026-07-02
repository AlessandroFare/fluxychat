/**
 * P23-9a: Realtime Tool Calling
 * Adapted from Vercel Chat SDK's realtime tool calling patterns.
 *
 * Execute tools during voice sessions (e.g., "book a table" → call reservation API).
 *
 * Usage:
 *   const toolHandler = createRealtimeToolHandler(env);
 *   await toolHandler.execute({
 *     name: "book_table",
 *     arguments: { restaurant: "Italian Place", time: "7pm" },
 *     sessionId: "voice-session-123",
 *   });
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} RealtimeToolCall
 * @property {string} name - Tool name
 * @property {Object} arguments - Tool arguments
 * @property {string} sessionId - Voice session ID
 * @property {string} [callId] - Unique call identifier
 */

/**
 * @typedef {Object} RealtimeToolResult
 * @property {boolean} success - Whether execution succeeded
 * @property {*} [result] - Tool result
 * @property {string} [error] - Error message
 * @property {number} [duration] - Execution duration in ms
 */

/**
 * @typedef {Object} RealtimeToolDefinition
 * @property {string} name - Tool name
 * @property {string} description - Tool description
 * @property {Object} parameters - JSON Schema for parameters
 * @property {(args: Object, context: { sessionId: string }) => Promise<*>} execute - Execution function
 */

// =============================================================================
// Realtime Tool Handler
// =============================================================================

/**
 * Create a realtime tool handler for voice sessions.
 * @param {import('./types.js').Env} env - Environment
 * @param {{ timeoutMs?: number, maxRetries?: number }} [options] - Options
 */
export function createRealtimeToolHandler(env, options = {}) {
  const { timeoutMs = 10000, maxRetries = 2 } = options;

  /** @type {Map<string, RealtimeToolDefinition>} */
  const tools = new Map();

  return {
    /**
     * Register a realtime tool.
     * @param {RealtimeToolDefinition} tool
     */
    register(tool) {
      tools.set(tool.name, tool);
    },

    /**
     * Register multiple tools.
     * @param {RealtimeToolDefinition[]} toolList
     */
    registerAll(toolList) {
      for (const tool of toolList) {
        this.register(tool);
      }
    },

    /**
     * List all registered tools.
     * @returns {Array<{ name: string, description: string, parameters: Object }>}
     */
    list() {
      return Array.from(tools.values()).map(({ execute, ...def }) => def);
    },

    /**
     * Execute a realtime tool call.
     * @param {RealtimeToolCall} call
     * @returns {Promise<RealtimeToolResult>}
     */
    async execute(call) {
      const tool = tools.get(call.name);
      if (!tool) {
        return {
          success: false,
          error: `Tool "${call.name}" not found`,
        };
      }

      const startTime = Date.now();
      let lastError;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await Promise.race([
            tool.execute(call.arguments, { sessionId: call.sessionId }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("Tool execution timeout")), timeoutMs)
            ),
          ]);

          return {
            success: true,
            result,
            duration: Date.now() - startTime,
          };
        } catch (error) {
          lastError = error;
          if (attempt < maxRetries) {
            await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          }
        }
      }

      return {
        success: false,
        error: lastError?.message || "Tool execution failed",
        duration: Date.now() - startTime,
      };
    },

    /**
     * Execute a tool by name with arguments.
     * @param {string} name - Tool name
     * @param {Object} args - Tool arguments
     * @param {string} sessionId - Voice session ID
     * @returns {Promise<RealtimeToolResult>}
     */
    async call(name, args, sessionId) {
      return this.execute({ name, arguments: args, sessionId });
    },

    /**
     * Check if a tool is registered.
     * @param {string} name - Tool name
     * @returns {boolean}
     */
    has(name) {
      return tools.has(name);
    },

    /**
     * Unregister a tool.
     * @param {string} name - Tool name
     * @returns {boolean}
     */
    unregister(name) {
      return tools.delete(name);
    },
  };
}

// =============================================================================
// Built-in Realtime Tools
// =============================================================================

/**
 * Create a weather tool for realtime voice queries.
 * @returns {RealtimeToolDefinition}
 */
export function createWeatherTool() {
  return {
    name: "get_weather",
    description: "Get current weather for a location",
    parameters: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name or coordinates" },
        unit: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius" },
      },
      required: ["location"],
    },
    execute: async (args) => {
      // In production, call a weather API
      return {
        location: args.location,
        temperature: 22,
        unit: args.unit || "celsius",
        condition: "sunny",
        humidity: 65,
      };
    },
  };
}

/**
 * Create a calculator tool for realtime voice queries.
 * @returns {RealtimeToolDefinition}
 */
export function createCalculatorTool() {
  return {
    name: "calculate",
    description: "Perform a mathematical calculation",
    parameters: {
      type: "object",
      properties: {
        expression: { type: "string", description: "Mathematical expression to evaluate" },
      },
      required: ["expression"],
    },
    execute: async (args) => {
      try {
        // Safe math evaluation (no eval)
        const result = Function(`"use strict"; return (${args.expression})`)();
        return { expression: args.expression, result };
      } catch (error) {
        throw new Error(`Invalid expression: ${error.message}`);
      }
    },
  };
}

/**
 * Create a booking tool for realtime voice sessions.
 * @returns {RealtimeToolDefinition}
 */
export function createBookingTool() {
  return {
    name: "book_reservation",
    description: "Book a reservation at a restaurant or venue",
    parameters: {
      type: "object",
      properties: {
        venue: { type: "string", description: "Venue name" },
        date: { type: "string", description: "Date (YYYY-MM-DD)" },
        time: { type: "string", description: "Time (HH:MM)" },
        partySize: { type: "number", description: "Number of guests" },
        name: { type: "string", description: "Name for reservation" },
        phone: { type: "string", description: "Contact phone number" },
      },
      required: ["venue", "date", "time", "partySize", "name"],
    },
    execute: async (args) => {
      // In production, call a booking API
      return {
        confirmationId: `BK-${Date.now()}`,
        venue: args.venue,
        date: args.date,
        time: args.time,
        partySize: args.partySize,
        name: args.name,
        status: "confirmed",
      };
    },
  };
}

/**
 * Create a navigation tool for realtime voice sessions.
 * @returns {RealtimeToolDefinition}
 */
export function createNavigationTool() {
  return {
    name: "get_directions",
    description: "Get directions between two locations",
    parameters: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Starting location" },
        destination: { type: "string", description: "Destination location" },
        mode: { type: "string", enum: ["driving", "walking", "transit"], default: "driving" },
      },
      required: ["origin", "destination"],
    },
    execute: async (args) => {
      // In production, call a maps API
      return {
        origin: args.origin,
        destination: args.destination,
        mode: args.mode || "driving",
        duration: "25 min",
        distance: "15 km",
        steps: [
          "Head north on Main St",
          "Turn right on Oak Ave",
          "Destination on the left",
        ],
      };
    },
  };
}

/**
 * Get all built-in realtime tools.
 * @returns {RealtimeToolDefinition[]}
 */
export function getBuiltinRealtimeTools() {
  return [
    createWeatherTool(),
    createCalculatorTool(),
    createBookingTool(),
    createNavigationTool(),
  ];
}
