/**
 * P22-F5: Lock Scope Abstraction
 * Adapted from Vercel Chat SDK's Adapter.lockScope.
 *
 * Configurable lock scope per adapter:
 * - thread: Lock at thread level (Slack, Teams)
 * - channel: Lock at channel level (WhatsApp, Telegram)
 * - room: Lock at room level (default)
 *
 * Usage:
 *   const lock = createLockScope(env, { scope: 'thread', resourceId: 'thread-123' });
 *   await lock.acquire();
 *   try {
 *     await processMessage();
 *   } finally {
 *     await lock.release();
 *   }
 */

// =============================================================================
// Lock Types
// =============================================================================

/**
 * @typedef {'thread' | 'channel' | 'room'} LockScope
 * @typedef {'slack' | 'teams' | 'discord' | 'telegram' | 'whatsapp' | 'google-chat' | 'github' | 'matrix' | 'irc' | 'twitch' | 'web'} Platform
 */

/**
 * @typedef {Object} LockResource
 * @property {string} id - Resource identifier
 * @property {LockScope} scope - Lock scope
 * @property {number} [ttl] - Time-to-live in ms (default: 30000)
 * @property {string} [owner] - Lock owner identifier
 */

// =============================================================================
// Lock Scope Manager
// =============================================================================

export class LockScopeManager {
  /**
   * @param {import('./types.js').Env} env
   */
  constructor(env) {
    /** @type {import('./types.js').Env} */
    this.env = env;
  }

  /**
   * Get lock scope for a platform.
   * @param {Platform} platform
   * @returns {LockScope}
   */
  getScopeForPlatform(platform) {
    const scopeMap = {
      slack: 'thread',
      teams: 'thread',
      discord: 'thread',
      telegram: 'channel',
      whatsapp: 'channel',
      'google-chat': 'thread',
      github: 'thread',
      matrix: 'room',
      irc: 'room',
      twitch: 'room',
      web: 'room',
    };

    return scopeMap[platform] || 'room';
  }

  /**
   * Generate lock key from resource.
   * @param {LockResource} resource
   * @returns {string}
   */
  getLockKey(resource) {
    return `lock:${resource.scope}:${resource.id}`;
  }

  /**
   * Acquire a lock on a resource.
   * @param {LockResource} resource
   * @param {string} [owner]
   * @returns {Promise<boolean>}
   */
  async acquire(resource, owner) {
    const key = this.getLockKey(resource);
    const ttl = resource.ttl || 30000;
    const lockOwner = owner || resource.owner || crypto.randomUUID();

    // Try to acquire lock using D1 with atomic operation
    const result = await this.env.DB.prepare(
      `INSERT INTO resource_locks (key, owner, acquired_at, expires_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET
         owner = CASE
           WHEN expires_at < ? THEN excluded.owner
           ELSE owner
         END,
         acquired_at = CASE
           WHEN expires_at < ? THEN excluded.acquired_at
           ELSE acquired_at
         END,
         expires_at = CASE
           WHEN expires_at < ? THEN excluded.expires_at
           ELSE expires_at
         END
       WHERE expires_at < ? OR owner = ?`
    )
      .bind(key, lockOwner, Date.now(), Date.now() + ttl, Date.now(), Date.now(), Date.now() + ttl, Date.now(), lockOwner)
      .run();

    // Check if lock was acquired
    const lock = await this.env.DB.prepare(
      `SELECT * FROM resource_locks WHERE key = ?`
    )
      .bind(key)
      .first();

    return lock?.owner === lockOwner;
  }

  /**
   * Release a lock on a resource.
   * @param {LockResource} resource
   * @param {string} [owner]
   * @returns {Promise<boolean>}
   */
  async release(resource, owner) {
    const key = this.getLockKey(resource);
    const lockOwner = owner || resource.owner;

    const result = await this.env.DB.prepare(
      `DELETE FROM resource_locks WHERE key = ? AND owner = ?`
    )
      .bind(key, lockOwner)
      .run();

    return (result.meta?.changes || 0) > 0;
  }

  /**
   * Check if a resource is locked.
   * @param {LockResource} resource
   * @returns {Promise<{ locked: boolean; owner?: string }>}
   */
  async isLocked(resource) {
    const key = this.getLockKey(resource);

    const lock = await this.env.DB.prepare(
      `SELECT * FROM resource_locks WHERE key = ? AND expires_at > ?`
    )
      .bind(key, Date.now())
      .first();

    return {
      locked: !!lock,
      owner: lock?.owner,
    };
  }

  /**
   * Clean up expired locks.
   * @returns {Promise<number>}
   */
  async cleanup() {
    const result = await this.env.DB.prepare(
      `DELETE FROM resource_locks WHERE expires_at < ?`
    )
      .bind(Date.now())
      .run();

    return result.meta?.changes || 0;
  }
}

// =============================================================================
// Lock Scope Wrapper
// =============================================================================

export class LockScope {
  /**
   * @param {LockScopeManager} manager
   * @param {LockResource} resource
   * @param {string} [owner]
   */
  constructor(manager, resource, owner) {
    /** @type {LockScopeManager} */
    this.manager = manager;
    /** @type {LockResource} */
    this.resource = resource;
    /** @type {string | undefined} */
    this.owner = owner;
    /** @type {boolean} */
    this.acquired = false;
  }

  /**
   * Acquire the lock.
   * @returns {Promise<boolean>}
   */
  async acquire() {
    this.acquired = await this.manager.acquire(this.resource, this.owner);
    return this.acquired;
  }

  /**
   * Release the lock.
   * @returns {Promise<boolean>}
   */
  async release() {
    if (!this.acquired) {
      return false;
    }

    const released = await this.manager.release(this.resource, this.owner);
    this.acquired = false;
    return released;
  }

  /**
   * Check if lock is held.
   * @returns {Promise<{ locked: boolean; owner?: string }>}
   */
  async isLocked() {
    return this.manager.isLocked(this.resource);
  }

  /**
   * Execute a function with the lock.
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   */
  async withLock(fn) {
    const acquired = await this.acquire();
    if (!acquired) {
      throw new Error(`Failed to acquire lock on ${this.resource.scope}:${this.resource.id}`);
    }

    try {
      return await fn();
    } finally {
      await this.release();
    }
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a lock scope manager.
 * @param {import('./types.js').Env} env
 * @returns {LockScopeManager}
 */
export function createLockScopeManager(env) {
  return new LockScopeManager(env);
}

/**
 * Create a lock scope for a resource.
 * @param {import('./types.js').Env} env
 * @param {LockResource} resource
 * @param {string} [owner]
 * @returns {LockScope}
 */
export function createLockScope(env, resource, owner) {
  const manager = new LockScopeManager(env);
  return new LockScope(manager, resource, owner);
}

/**
 * Create a lock scope for a platform and resource.
 * @param {import('./types.js').Env} env
 * @param {Platform} platform
 * @param {string} resourceId
 * @param {string} [owner]
 * @returns {LockScope}
 */
export function createPlatformLockScope(env, platform, resourceId, owner) {
  const manager = new LockScopeManager(env);
  const scope = manager.getScopeForPlatform(platform);
  return new LockScope(manager, { id: resourceId, scope }, owner);
}

// =============================================================================
// Predefined Lock Resources
// =============================================================================

/**
 * Create a thread lock resource.
 * @param {string} threadId
 * @param {string} [adapter]
 */
export function createThreadLock(threadId, adapter) {
  return {
    id: `thread:${adapter || 'web'}:${threadId}`,
    scope: 'thread',
    ttl: 30000,
  };
}

/**
 * Create a channel lock resource.
 * @param {string} channelId
 * @param {string} [adapter]
 */
export function createChannelLock(channelId, adapter) {
  return {
    id: `channel:${adapter || 'web'}:${channelId}`,
    scope: 'channel',
    ttl: 30000,
  };
}

/**
 * Create a room lock resource.
 * @param {string} roomId
 * @param {string} [adapter]
 */
export function createRoomLock(roomId, adapter) {
  return {
    id: `room:${adapter || 'web'}:${roomId}`,
    scope: 'room',
    ttl: 30000,
  };
}
