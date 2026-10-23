/**
 * P25-9: Strict Tool Calling
 * Adapted from Vercel Chat SDK's strict tool calling.
 *
 * Provider enforces valid input against schema (strict: true).
 *
 * Usage:
 *   const strictTool = createStrictTool({
 *     name: "get_weather",
 *     parameters: {
 *       type: "object",
 *       properties: {
 *         location: { type: "string" },
 *       },
 *       required: ["location"],
 *     },
 *   });
 *
 *   // Validates input against schema before execution
 *   await strictTool.execute({ location: "NYC" }); // OK
 *   await strictTool.execute({}); // Throws validation error
 */

import { compileSafeRegex } from "./safe-regex.js";

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} StrictToolConfig
 * @property {string} name - Tool name
 * @property {string} [description] - Tool description
 * @property {Object} parameters - JSON Schema for parameters
 * @property {(args: any) => Promise<any>} execute - Execution function
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether validation passed
 * @property {string[]} [errors] - Validation errors
 */

// =============================================================================
// Strict Tool Implementation
// =============================================================================

/**
 * Validate a value against a JSON Schema.
 * @param {any} value - Value to validate
 * @param {Object} schema - JSON Schema
 * @param {string} [path=''] - Current path for error messages
 * @returns {string[]} Array of validation errors
 */
export function validateSchema(value, schema, path = '') {
  const errors = [];

  if (!schema) return errors;

  // Type validation. Handles JSON Schema type unions (["string","null"]) and
  // `nullable` so a valid tool call is never rejected for shape we cannot
  // read; `null` is its own type (typeof null === "object" would pass object).
  if (schema.type) {
    const actualType = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const nullableOk = value === null && schema.nullable === true;

    if (!nullableOk && !expectedTypes.includes(actualType)) {
      errors.push(`${path || 'root'} must be of type ${expectedTypes.join('|')}, got ${actualType}`);
      return errors;
    }
  }

  // Array item validation
  if (schema.items && Array.isArray(value)) {
    value.forEach((item, i) => {
      errors.push(...validateSchema(item, schema.items, `${path}[${i}]`));
    });
  }

  // Required properties
  if (schema.required && typeof value === 'object' && value !== null) {
    for (const prop of schema.required) {
      if (value[prop] === undefined || value[prop] === null) {
        errors.push(`${path || 'root'}.${prop} is required`);
      }
    }
  }

  // Properties validation
  if (schema.properties && typeof value === 'object' && value !== null) {
    for (const [prop, propSchema] of Object.entries(schema.properties)) {
      if (value[prop] !== undefined) {
        errors.push(...validateSchema(value[prop], propSchema, `${path}.${prop}`));
      }
    }
  }

  // Enum validation
  if (schema.enum && !schema.enum.includes(value)) {
    errors.push(`${path || 'root'} must be one of: ${schema.enum.join(', ')}`);
  }

  // Minimum/Maximum
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push(`${path || 'root'} must be >= ${schema.minimum}`);
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push(`${path || 'root'} must be <= ${schema.maximum}`);
    }
  }

  // MinLength/MaxLength
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push(`${path || 'root'} must have length >= ${schema.minLength}`);
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push(`${path || 'root'} must have length <= ${schema.maxLength}`);
    }
  }

  // Pattern validation (audit F-51: schema patterns can be model-generated —
  // skip unsafe shapes instead of risking a hang).
  if (schema.pattern && typeof value === 'string') {
    const regex = compileSafeRegex(schema.pattern);
    if (regex && !regex.test(value)) {
      errors.push(`${path || 'root'} must match pattern: ${schema.pattern}`);
    }
  }

  return errors;
}

/**
 * Create a strict tool that validates input against schema.
 * @param {StrictToolConfig} config
 * @returns {{ name: string, description: string, parameters: Object, execute: (args: any) => Promise<any>, validate: (args: any) => ValidationResult }}
 */
export function createStrictTool(config) {
  const { name, description = '', parameters, execute } = config;

  return {
    name,
    description,
    parameters,
    strict: true,

    /**
     * Validate arguments against schema.
     * @param {any} args
     * @returns {ValidationResult}
     */
    validate(args) {
      const errors = validateSchema(args, parameters);
      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    /**
     * Execute tool with validation.
     * @param {any} args
     * @returns {Promise<any>}
     */
    async execute(args) {
      const validation = this.validate(args);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }
      return execute(args);
    },
  };
}

/**
 * Wrap an existing tool to add strict validation.
 * @param {Object} tool - Tool to wrap
 * @returns {Object} Wrapped tool with validation
 */
export function makeStrict(tool) {
  const { execute, parameters, ...rest } = tool;

  return {
    ...rest,
    parameters,
    strict: true,

    validate(args) {
      const errors = validateSchema(args, parameters);
      return {
        valid: errors.length === 0,
        errors: errors.length > 0 ? errors : undefined,
      };
    },

    async execute(args) {
      const validation = this.validate(args);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors?.join(', ')}`);
      }
      return execute(args);
    },
  };
}
