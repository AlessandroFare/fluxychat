/**
 * P24-7: Structured Output — Worker Implementation
 * JSON schema constrained generation.
 */

/**
 * Generate a system prompt suffix for structured output.
 * @param {Object} schema
 */
export function structuredOutputPrompt(schema) {
  const schemaStr = JSON.stringify(schema, null, 2);
  return `\n\nIMPORTANT: You MUST respond with valid JSON that matches this schema exactly:\n${schemaStr}\n\nDo not include any text before or after the JSON. No markdown code fences. Just the raw JSON object.`;
}

/**
 * Parse LLM output as structured JSON.
 * @param {string} text
 * @param {Object} schema
 */
export function parseStructuredOutput(text, schema) {
  const errors = [];
  let object = null;

  // Clean the text
  let cleaned = text.trim();

  // Remove markdown code fences
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  // Try to parse
  try {
    object = JSON.parse(cleaned);
  } catch (parseErr) {
    errors.push(`JSON parse error: ${parseErr.message}`);

    // Try to fix common issues
    const fixed = cleaned
      .replace(/,\s*([\]}])/g, "$1") // Remove trailing commas
      .replace(/[\x00-\x1F\x7F]/g, " "); // Remove control characters

    try {
      object = JSON.parse(fixed);
    } catch {
      errors.push("Failed to parse even after cleanup");
    }
  }

  // Validate against schema
  if (object && schema) {
    const validation = validateAgainstSchema(object, schema);
    if (!validation.valid) {
      errors.push(...validation.errors);
    }
  }

  return {
    object,
    valid: errors.length === 0,
    errors,
    rawText: text,
  };
}

/**
 * Validate an object against a JSON schema (basic validation).
 * @param {*} obj
 * @param {Object} schema
 */
export function validateAgainstSchema(obj, schema) {
  const errors = [];

  if (!schema) return { valid: true, errors };

  if (schema.type) {
    const actualType = Array.isArray(obj) ? "array" : typeof obj;
    if (schema.type === "array") {
      if (!Array.isArray(obj)) {
        errors.push(`Expected array, got ${actualType}`);
      }
    } else if (actualType !== schema.type) {
      errors.push(`Expected type "${schema.type}", got "${actualType}"`);
    }
  }

  if (schema.required && Array.isArray(schema.required)) {
    for (const key of schema.required) {
      if (obj == null || !(key in obj)) {
        errors.push(`Missing required property: "${key}"`);
      }
    }
  }

  if (schema.properties && typeof obj === "object" && obj !== null) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (obj[key] !== undefined) {
        const nested = validateAgainstSchema(obj[key], propSchema);
        if (!nested.valid) {
          errors.push(...nested.errors.map((e) => `${key}.${e}`));
        }
      }
    }
  }

  if (schema.enum && !schema.enum.includes(obj)) {
    errors.push(`Value must be one of: ${schema.enum.join(", ")}`);
  }

  if (schema.minimum != null && typeof obj === "number" && obj < schema.minimum) {
    errors.push(`Value must be >= ${schema.minimum}`);
  }

  if (schema.maximum != null && typeof obj === "number" && obj > schema.maximum) {
    errors.push(`Value must be <= ${schema.maximum}`);
  }

  if (schema.minLength != null && typeof obj === "string" && obj.length < schema.minLength) {
    errors.push(`String length must be >= ${schema.minLength}`);
  }

  if (schema.maxLength != null && typeof obj === "string" && obj.length > schema.maxLength) {
    errors.push(`String length must be <= ${schema.maxLength}`);
  }

  if (schema.pattern && typeof obj === "string" && !new RegExp(schema.pattern).test(obj)) {
    errors.push(`String must match pattern: ${schema.pattern}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Create a structured output wrapper for an LLM call.
 * @param {Function} llmCall
 * @param {Object} config
 */
export async function withStructuredOutput(llmCall, config) {
  const { schema, defaultValue = null, retryOnFailure = true, maxRetries = 2 } = config;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const text = await llmCall();
    const result = parseStructuredOutput(text, schema);

    if (result.valid) {
      return result;
    }

    if (!retryOnFailure || attempt === maxRetries) {
      return {
        object: defaultValue,
        valid: false,
        errors: result.errors,
        rawText: text,
      };
    }
  }

  return {
    object: defaultValue,
    valid: false,
    errors: ["Max retries exceeded"],
    rawText: "",
  };
}
