/**
 * Shared synchronous validation helpers for Worker route parameters.
 *
 * These helpers are intentionally simple: they parse numeric query/body/path
 * parameters and return a structured result so callers can decide whether to
 * return a 400 response or fall back to a default.
 */

/**
 * Determine whether a value is a finite number literal (string or number).
 * Booleans are rejected because `Number(true) === 1` would silently accept
 * invalid input.
 *
 * @param {unknown} value
 * @returns {value is string | number}
 */
function isNumericInput(value) {
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "boolean") return false;
  return typeof value === "string" || typeof value === "number";
}

/**
 * Parse and validate a limit parameter.
 *
 * - Missing, `null`, `undefined`, or empty string values fall back to
 *   `opts.defaultValue` (default 20).
 * - Values are clamped to `opts.max` (default 1000).
 * - Non-numeric, non-integer, negative, and zero values are rejected.
 *
 * @param {unknown} value
 * @param {Object} opts
 * @param {number} [opts.defaultValue=20]
 * @param {number} [opts.max=1000]
 * @param {boolean} [opts.allowUndefined=false]
 * @param {boolean} [opts.throwOnError=false]
 * @returns {{ value: number | undefined } | { value: undefined, error: string }}
 */
export function validateLimit(value, opts = {}) {
  const defaultValue = opts.defaultValue ?? 20;
  const max = opts.max ?? 1000;

  if (value === undefined || value === null) {
    return { value: opts.allowUndefined ? undefined : defaultValue };
  }

  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "") {
    return { value: opts.allowUndefined ? undefined : defaultValue };
  }

  if (typeof raw === "boolean" || (typeof raw !== "string" && typeof raw !== "number")) {
    const error = "limit must be a positive integer";
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  const num = Number(raw);
  if (!Number.isFinite(num) || Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
    const error = "limit must be a positive integer";
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  return { value: Math.min(num, max) };
}

/**
 * Parse and validate a positive integer parameter (ID, page number, count, etc.).
 *
 * - Missing, `null`, `undefined`, or empty string values are rejected.
 * - Non-numeric, non-integer, negative, and zero values are rejected.
 *
 * @param {unknown} value
 * @param {Object} opts
 * @param {string} [opts.fieldName="value"]
 * @param {boolean} [opts.throwOnError=false]
 * @returns {{ value: number } | { value: undefined, error: string }}
 */
export function validatePositiveInteger(value, opts = {}) {
  const fieldName = opts.fieldName ?? "value";

  if (value === undefined || value === null) {
    const error = `${fieldName} is required`;
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  const raw = typeof value === "string" ? value.trim() : value;
  if (raw === "") {
    const error = `${fieldName} is required`;
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  if (typeof raw === "boolean" || (typeof raw !== "string" && typeof raw !== "number")) {
    const error = `${fieldName} must be a positive integer`;
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  const num = Number(raw);
  if (!Number.isFinite(num) || Number.isNaN(num) || !Number.isInteger(num) || num <= 0) {
    const error = `${fieldName} must be a positive integer`;
    if (opts.throwOnError) throw new Error(error);
    return { value: undefined, error };
  }

  return { value: num };
}
