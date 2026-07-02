/**
 * P26-C3: Chat singleton for thread deserialization.
 * Adapted from Vercel Chat SDK's `chat-singleton.ts`.
 *
 * Global singleton registry that stores chat/adapter references.
 * This enables `Thread.fromJSON()` to resolve adapters without an
 * explicit Chat instance being passed through every call.
 *
 * Separate module to avoid circular dependency between chat-api and thread.
 */

// =============================================================================
// Types (JSDoc)
// =============================================================================

/**
 * @typedef {Object} ChatSingletonInterface
 * @property {(name: string) => (Object|undefined)} getAdapter - Get adapter by name
 * @property {() => Object} getState - Get the state adapter
 */

// =============================================================================
// Singleton State
// =============================================================================

/** @type {Map<string, Object>} */
const _instances = new Map();

/** @type {string|null} */
let _defaultName = null;

// =============================================================================
// Registration
// =============================================================================

/**
 * Register a Chat instance by name.
 * The first registered instance becomes the default.
 *
 * @param {string} name - Instance name (e.g., "default", "project-123")
 * @param {Object} chat - Chat instance with `getAdapter(name)` method
 */
export function registerChatInstance(name, chat) {
  if (!name || typeof name !== "string") {
    throw new Error("registerChatInstance: name is required");
  }
  if (!chat || typeof chat !== "object") {
    throw new Error("registerChatInstance: chat instance is required");
  }
  _instances.set(name, chat);
  if (_defaultName === null) {
    _defaultName = name;
  }
}

/**
 * Get a Chat instance by name, or the default instance if no name is given.
 *
 * @param {string} [name] - Optional instance name
 * @returns {Object} Chat instance
 * @throws {Error} if no instance is registered with that name, or no default exists
 */
export function getChatInstance(name) {
  const key = name || _defaultName;
  if (!key) {
    throw new Error(
      "No Chat instance registered. Call registerChatInstance() first."
    );
  }
  const instance = _instances.get(key);
  if (!instance) {
    throw new Error(
      `Chat instance "${key}" not found. Call registerChatInstance("${key}", chat) first.`
    );
  }
  return instance;
}

/**
 * Resolve an adapter from the singleton (or default instance).
 *
 * @param {string} adapterName - Adapter name (e.g., "slack", "web")
 * @returns {Object|undefined} Adapter instance or undefined
 */
export function resolveAdapter(adapterName) {
  if (!_defaultName) return undefined;
  const instance = _instances.get(_defaultName);
  if (!instance) return undefined;

  // If the instance has a getAdapter method, use it
  if (typeof instance.getAdapter === "function") {
    return instance.getAdapter(adapterName);
  }

  // If the instance has an adapters map, look it up
  if (instance.adapters && typeof instance.adapters === "object") {
    return instance.adapters[adapterName];
  }

  return undefined;
}

// =============================================================================
// Introspection
// =============================================================================

/**
 * Check if a Chat singleton has been registered.
 * @returns {boolean}
 */
export function hasChatInstance() {
  return _instances.size > 0;
}

/**
 * Get the names of all registered instances.
 * @returns {string[]}
 */
export function listChatInstances() {
  return Array.from(_instances.keys());
}

/**
 * Get the default instance name.
 * @returns {string|null}
 */
export function getDefaultChatInstanceName() {
  return _defaultName;
}

/**
 * Set a specific registered instance as the default.
 * @param {string} name
 */
export function setDefaultChatInstance(name) {
  if (!_instances.has(name)) {
    throw new Error(`Cannot set default: instance "${name}" not registered`);
  }
  _defaultName = name;
}

/**
 * Unregister a Chat instance.
 * If it was the default, the next registered instance becomes default.
 *
 * @param {string} name - Instance name to remove
 */
export function unregisterChatInstance(name) {
  _instances.delete(name);
  if (_defaultName === name) {
    const remaining = Array.from(_instances.keys());
    _defaultName = remaining.length > 0 ? remaining[0] : null;
  }
}

/**
 * Clear all registered instances (for testing).
 */
export function clearChatInstances() {
  _instances.clear();
  _defaultName = null;
}
