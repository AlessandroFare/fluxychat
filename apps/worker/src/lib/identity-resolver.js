/**
 * P22-F6: Identity Resolver
 * Adapted from Vercel Chat SDK's IdentityResolver.
 *
 * Cross-platform user identity mapping via userKey.
 * Same user on Slack, web, and mobile gets unified identity.
 *
 * Usage:
 *   const identity = await resolveIdentity(env, { platform: 'slack', platformUserId: 'U123' });
 *   const unifiedId = identity.fluxyUserId;
 */

// =============================================================================
// Identity Types
// =============================================================================

/**
 * @typedef {Object} PlatformIdentity
 * @property {string} platform
 * @property {string} platformUserId
 * @property {string} [platformUsername]
 * @property {Object} [platformData]
 */

/**
 * @typedef {Object} UnifiedIdentity
 * @property {string} fluxyUserId
 * @property {string} [clerkUserId]
 * @property {PlatformIdentity[]} platforms
 * @property {Object} [metadata]
 */

// =============================================================================
// Identity Resolver
// =============================================================================

export class IdentityResolver {
  /**
   * @param {import('./types.js').Env} env
   */
  constructor(env) {
    /** @type {import('./types.js').Env} */
    this.env = env;
  }

  /**
   * Resolve a platform identity to a unified FluxyChat identity.
   * @param {PlatformIdentity} platformIdentity
   * @returns {Promise<UnifiedIdentity>}
   */
  async resolve(platformIdentity) {
    const { platform, platformUserId } = platformIdentity;

    // Check if mapping exists
    const existing = await this.env.DB.prepare(
      `SELECT * FROM platform_identities WHERE platform = ? AND platform_user_id = ?`
    )
      .bind(platform, platformUserId)
      .first();

    if (existing) {
      // Update last seen
      await this.env.DB.prepare(
        `UPDATE platform_identities SET last_seen = ?, platform_data = ? WHERE platform = ? AND platform_user_id = ?`
      )
        .bind(Date.now(), JSON.stringify(platformIdentity.platformData || {}), platform, platformUserId)
        .run();

      return this.getUnifiedIdentity(existing.fluxy_user_id);
    }

    // Check if user exists by platform username
    if (platformIdentity.platformUsername) {
      const byUsername = await this.env.DB.prepare(
        `SELECT * FROM platform_identities WHERE platform = ? AND platform_username = ?`
      )
        .bind(platform, platformIdentity.platformUsername)
        .first();

      if (byUsername) {
        // Link to existing user
        await this.env.DB.prepare(
          `INSERT INTO platform_identities (platform, platform_user_id, platform_username, fluxy_user_id, platform_data, created_at, last_seen)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(platform, platform_user_id) DO UPDATE SET
             platform_username = excluded.platform_username,
             fluxy_user_id = excluded.fluxy_user_id,
             platform_data = excluded.platform_data,
             last_seen = excluded.last_seen`
        )
          .bind(
            platform,
            platformUserId,
            platformIdentity.platformUsername,
            byUsername.fluxy_user_id,
            JSON.stringify(platformIdentity.platformData || {}),
            Date.now(),
            Date.now()
          )
          .run();

        return this.getUnifiedIdentity(byUsername.fluxy_user_id);
      }
    }

    // Create new unified identity
    const fluxyUserId = crypto.randomUUID();

    await this.env.DB.prepare(
      `INSERT INTO platform_identities (platform, platform_user_id, platform_username, fluxy_user_id, platform_data, created_at, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        platform,
        platformUserId,
        platformIdentity.platformUsername || '',
        fluxyUserId,
        JSON.stringify(platformIdentity.platformData || {}),
        Date.now(),
        Date.now()
      )
      .run();

    return this.getUnifiedIdentity(fluxyUserId);
  }

  /**
   * Get unified identity by FluxyChat user ID.
   * @param {string} fluxyUserId
   * @returns {Promise<UnifiedIdentity>}
   */
  async getUnifiedIdentity(fluxyUserId) {
    const platforms = await this.env.DB.prepare(
      `SELECT * FROM platform_identities WHERE fluxy_user_id = ?`
    )
      .bind(fluxyUserId)
      .all();

    // Get Clerk user ID if exists
    const clerkUser = await this.env.DB.prepare(
      `SELECT clerk_user_id FROM users WHERE fluxy_user_id = ?`
    )
      .bind(fluxyUserId)
      .first();

    return {
      fluxyUserId,
      clerkUserId: clerkUser?.clerk_user_id,
      platforms: platforms.results.map((row) => ({
        platform: row.platform,
        platformUserId: row.platform_user_id,
        platformUsername: row.platform_username,
        platformData: JSON.parse(row.platform_data || '{}'),
      })),
      metadata: {},
    };
  }

  /**
   * Link a platform identity to an existing FluxyChat user.
   * @param {string} fluxyUserId
   * @param {PlatformIdentity} platformIdentity
   * @returns {Promise<void>}
   */
  async link(fluxyUserId, platformIdentity) {
    const { platform, platformUserId } = platformIdentity;

    await this.env.DB.prepare(
      `INSERT INTO platform_identities (platform, platform_user_id, platform_username, fluxy_user_id, platform_data, created_at, last_seen)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(platform, platform_user_id) DO UPDATE SET
         platform_username = excluded.platform_username,
         fluxy_user_id = excluded.fluxy_user_id,
         platform_data = excluded.platform_data,
         last_seen = excluded.last_seen`
    )
      .bind(
        platform,
        platformUserId,
        platformIdentity.platformUsername || '',
        fluxyUserId,
        JSON.stringify(platformIdentity.platformData || {}),
        Date.now(),
        Date.now()
      )
      .run();
  }

  /**
   * Unlink a platform identity.
   * @param {string} platform
   * @param {string} platformUserId
   * @returns {Promise<boolean>}
   */
  async unlink(platform, platformUserId) {
    const result = await this.env.DB.prepare(
      `DELETE FROM platform_identities WHERE platform = ? AND platform_user_id = ?`
    )
      .bind(platform, platformUserId)
      .run();

    return (result.meta?.changes || 0) > 0;
  }

  /**
   * Get all identities for a platform.
   * @param {string} platform
   * @param {{ limit?: number, offset?: number }} options
   * @returns {Promise<UnifiedIdentity[]>}
   */
  async listByPlatform(platform, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const result = await this.env.DB.prepare(
      `SELECT DISTINCT fluxy_user_id FROM platform_identities WHERE platform = ? LIMIT ? OFFSET ?`
    )
      .bind(platform, limit, offset)
      .all();

    const identities = [];
    for (const row of result.results) {
      identities.push(await this.getUnifiedIdentity(row.fluxy_user_id));
    }

    return identities;
  }

  /**
   * Search identities by username.
   * @param {string} query
   * @param {{ platform?: string, limit?: number }} options
   * @returns {Promise<UnifiedIdentity[]>}
   */
  async search(query, options = {}) {
    const { platform, limit = 20 } = options;

    let sql = `SELECT DISTINCT fluxy_user_id FROM platform_identities WHERE platform_username LIKE ?`;
    /** @type {any[]} */
    const params = [`%${query}%`];

    if (platform) {
      sql += ` AND platform = ?`;
      params.push(platform);
    }

    sql += ` LIMIT ?`;
    params.push(limit);

    const result = await this.env.DB.prepare(sql)
      .bind(...params)
      .all();

    const identities = [];
    for (const row of result.results) {
      identities.push(await this.getUnifiedIdentity(row.fluxy_user_id));
    }

    return identities;
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Resolve a platform identity to a unified FluxyChat identity.
 * @param {import('./types.js').Env} env
 * @param {PlatformIdentity} platformIdentity
 * @returns {Promise<UnifiedIdentity>}
 */
export async function resolveIdentity(env, platformIdentity) {
  const resolver = new IdentityResolver(env);
  return resolver.resolve(platformIdentity);
}

/**
 * Get unified identity by FluxyChat user ID.
 * @param {import('./types.js').Env} env
 * @param {string} fluxyUserId
 * @returns {Promise<UnifiedIdentity>}
 */
export async function getIdentity(env, fluxyUserId) {
  const resolver = new IdentityResolver(env);
  return resolver.getUnifiedIdentity(fluxyUserId);
}

/**
 * Link a platform identity to an existing FluxyChat user.
 * @param {import('./types.js').Env} env
 * @param {string} fluxyUserId
 * @param {PlatformIdentity} platformIdentity
 * @returns {Promise<void>}
 */
export async function linkIdentity(env, fluxyUserId, platformIdentity) {
  const resolver = new IdentityResolver(env);
  return resolver.link(fluxyUserId, platformIdentity);
}
