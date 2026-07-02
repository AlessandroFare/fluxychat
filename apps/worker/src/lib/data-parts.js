/**
 * P24-5: Custom Types + Data Parts — Worker Implementation
 * P24-6: useObject — Streaming structured objects.
 */

/**
 * Create a data part registry.
 */
export function createDataPartRegistry() {
  const parsers = new Map();

  return {
    register(parser) {
      parsers.set(parser.type, parser);
    },

    get(type) {
      return parsers.get(type) || null;
    },

    parse(type, raw) {
      const parser = parsers.get(type);
      if (!parser) return raw;
      return parser.parse(raw);
    },

    serialize(type, data) {
      const parser = parsers.get(type);
      if (!parser) return data;
      return parser.serialize(data);
    },
  };
}

/**
 * Built-in data part parsers.
 */
export const BUILTIN_PARSERS = {
  text: {
    type: "text",
    parse: (raw) => (typeof raw === "string" ? raw : String(raw)),
    serialize: (data) => data,
  },
  "tool-call": {
    type: "tool-call",
    parse: (raw) => ({
      toolCallId: raw.toolCallId || "",
      toolName: raw.toolName || "",
      args: raw.args || {},
    }),
    serialize: (data) => data,
  },
  "tool-result": {
    type: "tool-result",
    parse: (raw) => ({
      toolCallId: raw.toolCallId || "",
      result: raw.result,
      success: raw.success ?? true,
    }),
    serialize: (data) => data,
  },
  json: {
    type: "json",
    parse: (raw) => {
      if (typeof raw === "string") {
        try {
          return JSON.parse(raw);
        } catch {
          return null;
        }
      }
      return raw;
    },
    serialize: (data) => JSON.stringify(data),
  },
  image: {
    type: "image",
    parse: (raw) => ({
      url: raw.url || "",
      mimeType: raw.mimeType || "image/png",
      alt: raw.alt || "",
    }),
    serialize: (data) => data,
  },
};

/**
 * Parse a partial JSON string and return what can be parsed.
 * Handles incomplete JSON gracefully.
 * @param {string} partial
 */
export function parsePartialJSON(partial) {
  if (!partial) return null;

  // Try full parse first
  try {
    return JSON.parse(partial);
  } catch {
    // Continue
  }

  // Try to fix common incomplete patterns
  let fixed = partial.trim();

  // Remove trailing commas before closing brackets
  fixed = fixed.replace(/,\s*([\]}])/g, "$1");

  // Try parsing again
  try {
    return JSON.parse(fixed);
  } catch {
    // Continue
  }

  // Try adding closing brackets
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;

  let closing = "";
  for (let i = 0; i < openBrackets - closeBrackets; i++) closing += "]";
  for (let i = 0; i < openBraces - closeBraces; i++) closing += "}";

  if (closing) {
    try {
      return JSON.parse(fixed + closing);
    } catch {
      // Continue
    }
  }

  // Try to extract partial key-value pairs
  const keyValuePairs = {};
  const regex = /"([^"]+)"\s*:\s*("([^"]*)"|(\d+\.?\d*)|true|false|null|\{[^}]*\}|\[[^\]]*\])/g;
  let match;
  while ((match = regex.exec(fixed)) !== null) {
    const key = match[1];
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    } else if (!isNaN(value)) {
      value = Number(value);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (value === "null") {
      value = null;
    }
    keyValuePairs[key] = value;
  }

  return Object.keys(keyValuePairs).length > 0 ? keyValuePairs : null;
}

/**
 * useObject hook for streaming structured objects.
 * This is a server-side implementation; the React hook would be in a separate file.
 * @param {Object} options
 */
export function useObject({ schema, initialValue = null, onPartial, onComplete, onError } = {}) {
  let object = initialValue;
  let isComplete = false;
  let error = null;
  let controller = null;

  return {
    get object() { return object; },
    get isComplete() { return isComplete; },
    get error() { return error; },

    async send(prompt) {
      controller = new AbortController();
      isComplete = false;
      error = null;

      try {
        // In production, this would call the LLM with schema-constrained generation
        // For now, simulate streaming partial JSON
        const partial = "{}";
        object = parsePartialJSON(partial) || initialValue;
        isComplete = true;

        if (onPartial) onPartial(object);
        if (onComplete) onComplete(object);
      } catch (err) {
        error = err;
        if (onError) onError(err);
      }
    },

    abort() {
      if (controller) {
        controller.abort();
        isComplete = true;
      }
    },
  };
}
