/**
 * P26-A-3: PostableObject formal interface
 * Adapted from Vercel Chat SDK's postable-object.ts.
 *
 * Defines a formal interface with $$typeof symbol for type-safe
 * postable objects. Objects implementing this interface (Card, Plan, Poll)
 * can be passed to thread.post() and the adapter handles them specially.
 *
 * The isSupported() method lets objects gracefully degrade on adapters
 * that don't support them.
 *
 * @example
 * ```js
 * import { POSTABLE_OBJECT, isPostableObject } from "./postable-object.js";
 *
 * class MyCustomObject {
 *   get $$typeof() { return POSTABLE_OBJECT; }
 *   get kind() { return "my-custom"; }
 *   isSupported(adapter) { return adapter.slug === "web"; }
 *   getFallbackText() { return "Custom object (not supported here)"; }
 *   getPostData() { return { ... }; }
 *   onPosted(context) { this.messageId = context.messageId; }
 * }
 * ```
 */

// =============================================================================
// Symbol
// =============================================================================

/**
 * Symbol identifying PostableObject instances.
 * Used by type guards to detect postable objects.
 * Uses Symbol.for() for cross-realm support (works across iframes, workers).
 */
export const POSTABLE_OBJECT = Symbol.for("fluxy.postable");

// =============================================================================
// PostableObjectContext
// =============================================================================

/**
 * @typedef {Object} PostableObjectContext
 * @property {Object} adapter - Adapter instance
 * @property {string} messageId - Sent message ID
 * @property {string} threadId - Thread ID
 * @property {Object} [logger] - Optional logger
 */

// =============================================================================
// PostableObject Interface (JSDoc)
// =============================================================================

/**
 * @typedef {Object} PostableObject
 * @property {symbol} $$typeof - Must equal POSTABLE_OBJECT
 * @property {string} kind - Object kind (e.g. "card", "plan", "poll")
 * @property {Function} getFallbackText - Returns string for unsupported adapters
 * @property {Function} getPostData - Returns data to send to adapter
 * @property {Function} isSupported - (adapter) => boolean
 * @property {Function} onPosted - (context: PostableObjectContext) => void
 */

// =============================================================================
// Type Guard
// =============================================================================

/**
 * Check if a value is a PostableObject.
 * @param {unknown} value
 * @returns {value is PostableObject}
 */
export function isPostableObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    value.$$typeof === POSTABLE_OBJECT
  );
}

// =============================================================================
// Post Helper
// =============================================================================

/**
 * Post a PostableObject using the adapter's native support or fallback text.
 *
 * @param {Object} obj - PostableObject instance
 * @param {Object} adapter - Adapter instance (or null for web)
 * @param {string} threadId - Thread ID
 * @param {Function} postFn - Fallback: (threadId, message) => Promise<{id, threadId?}>
 * @param {Object} [logger]
 * @returns {Promise<void>}
 */
export async function postPostableObject(obj, adapter, threadId, postFn, logger) {
  const createContext = (raw) => ({
    adapter,
    logger,
    messageId: raw.id,
    threadId: raw.threadId ?? threadId,
  });

  if (obj.isSupported(adapter) && adapter?.postObject) {
    const raw = await adapter.postObject(threadId, obj.kind, obj.getPostData());
    obj.onPosted(createContext(raw));
  } else {
    const raw = await postFn(threadId, obj.getFallbackText());
    obj.onPosted(createContext(raw));
  }
}

// =============================================================================
// Mixin Helper
// =============================================================================

/**
 * Mixin to make a class implement PostableObject.
 *
 * @example
 * ```js
 * class MyCard {
 *   static [Symbol.for("fluxy.postable")] = POSTABLE_OBJECT;
 *   // ... or use the mixin
 * }
 * ```
 *
 * @param {Function} Base - Base class
 * @returns {Function} Extended class with PostableObject interface
 */
export function withPostable(Base) {
  return class extends Base {
    get $$typeof() {
      return POSTABLE_OBJECT;
    }

    isSupported(_adapter) {
      // Default: supported everywhere (override in subclass)
      return true;
    }

    onPosted(_context) {
      // Default: no-op (override in subclass)
    }
  };
}
