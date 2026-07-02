/**
 * P25-12: Sensitive Context Controls
 * Adapted from Vercel Chat SDK's telemetry sensitivity.
 *
 * Prevent secrets from appearing in telemetry.
 *
 * Usage:
 *   const sanitizer = createSensitiveContextSanitizer({
 *     patterns: [/api[_-]?key/gi, /password/gi],
 *     maskValue: '***',
 *   });
 *
 *   const safe = sanitizer.sanitize("My API key is sk-1234567890");
 *   // "My API key is ***"
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} SanitizerConfig
 * @property {Array<RegExp | string>} [patterns] - Patterns to match
 * @property {string} [maskValue] - Value to replace matches with (default: '***')
 * @property {string[]} [sensitiveKeys] - Object keys to sanitize (default: common keys)
 * @property {boolean} [recursive] - Sanitize nested objects (default: true)
 * @property {number} [maxDepth] - Max nesting depth (default: 10)
 */

// =============================================================================
// Sensitive Context Sanitizer
// =============================================================================

/**
 * Default sensitive patterns (API keys, passwords, tokens, etc.)
 */
export const DEFAULT_SENSITIVE_PATTERNS = [
  // API Keys
  /sk[_-]?[a-zA-Z0-9]{20,}/g,
  /api[_-]?key[_-]?[a-zA-Z0-9]{20,}/gi,
  /token[_-]?[a-zA-Z0-9]{20,}/gi,
  
  // Passwords
  /password[_-]?[a-zA-Z0-9]{8,}/gi,
  /pwd[_-]?[a-zA-Z0-9]{8,}/gi,
  
  // Secrets
  /secret[_-]?[a-zA-Z0-9]{20,}/gi,
  /client[_-]?secret[_-]?[a-zA-Z0-9]{20,}/gi,
  
  // JWT
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,
  
  // Private Keys
  /-----BEGIN (RSA |EC )?PRIVATE KEY-----[\s\S]*?-----END (RSA |EC )?PRIVATE KEY-----/g,
  
  // Credit Cards (basic pattern)
  /\b[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}[\s-]?[0-9]{4}\b/g,
  
  // SSN (US)
  /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,
];

/**
 * Default sensitive object keys
 */
export const DEFAULT_SENSITIVE_KEYS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'api_key',
  'apiKey',
  'apikey',
  'access_token',
  'accessToken',
  'refresh_token',
  'refreshToken',
  'private_key',
  'privateKey',
  'credentials',
  'authorization',
  'auth',
  'token',
  'secret_key',
  'secretKey',
  'database_url',
  'databaseUrl',
  'connection_string',
  'connectionString',
];

/**
 * Create a sensitive context sanitizer.
 * @param {SanitizerConfig} [config]
 */
export function createSensitiveContextSanitizer(config = {}) {
  const {
    patterns = DEFAULT_SENSITIVE_PATTERNS,
    maskValue = '***',
    sensitiveKeys = DEFAULT_SENSITIVE_KEYS,
    recursive = true,
    maxDepth = 10,
  } = config;

  /**
   * Sanitize a string value.
   * @param {string} value
   * @returns {string}
   */
  function sanitizeString(value) {
    let result = value;
    for (const pattern of patterns) {
      result = result.replace(pattern, maskValue);
    }
    return result;
  }

  /**
   * Sanitize an object recursively.
   * @param {any} obj
   * @param {number} depth
   * @returns {any}
   */
  function sanitizeObject(obj, depth = 0) {
    if (depth > maxDepth) return obj;
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === 'string') return sanitizeString(obj);
    if (typeof obj === 'number' || typeof obj === 'boolean') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeObject(item, depth + 1));
    }

    if (typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveKeys.some(
          (sk) => lowerKey.includes(sk.toLowerCase())
        );

        if (isSensitive && typeof value === 'string') {
          sanitized[key] = maskValue;
        } else if (recursive) {
          sanitized[key] = sanitizeObject(value, depth + 1);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    }

    return obj;
  }

  return {
    /**
     * Sanitize a value (string, object, or array).
     * @param {any} value
     * @returns {any}
     */
    sanitize(value) {
      if (typeof value === 'string') {
        return sanitizeString(value);
      }
      return sanitizeObject(value);
    },

    /**
     * Sanitize a log entry.
     * @param {Object} logEntry
     * @returns {Object}
     */
    sanitizeLogEntry(logEntry) {
      return {
        ...logEntry,
        message: sanitizeString(logEntry.message || ''),
        data: sanitizeObject(logEntry.data),
      };
    },

    /**
     * Sanitize telemetry data.
     * @param {Object} telemetry
     * @returns {Object}
     */
    sanitizeTelemetry(telemetry) {
      return sanitizeObject(telemetry);
    },

    /**
     * Add a custom pattern.
     * @param {RegExp} pattern
     */
    addPattern(pattern) {
      patterns.push(pattern);
    },

    /**
     * Add a custom sensitive key.
     * @param {string} key
     */
    addSensitiveKey(key) {
      sensitiveKeys.push(key);
    },

    /**
     * Get all patterns.
     * @returns {Array<RegExp | string>}
     */
    getPatterns() {
      return [...patterns];
    },

    /**
     * Get all sensitive keys.
     * @returns {string[]}
     */
    getSensitiveKeys() {
      return [...sensitiveKeys];
    },
  };
}

/**
 * Check if a value contains sensitive data.
 * @param {any} value
 * @returns {boolean}
 */
export function containsSensitiveData(value) {
  const sanitizer = createSensitiveContextSanitizer();
  const sanitized = sanitizer.sanitize(value);
  return JSON.stringify(sanitized) !== JSON.stringify(value);
}

/**
 * Sanitize a value if it contains sensitive data.
 * @param {any} value
 * @param {any} fallback - Fallback value if sensitive
 * @returns {any}
 */
export function sanitizeIfSensitive(value, fallback = '***') {
  if (containsSensitiveData(value)) {
    const sanitizer = createSensitiveContextSanitizer();
    return sanitizer.sanitize(value);
  }
  return value;
}
