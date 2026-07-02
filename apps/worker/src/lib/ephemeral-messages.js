/**
 * P25-6: Ephemeral Messages
 * Adapted from Vercel Chat SDK's ephemeral message support.
 *
 * User-only visible messages with DM fallback.
 *
 * Usage:
 *   await sendEphemeralMessage(env, {
 *     roomId: "room-123",
 *     userId: "user-456",
 *     content: "This is a private notification",
 *   });
 */

// =============================================================================
// Types
// =============================================================================

/**
 * @typedef {Object} EphemeralMessage
 * @property {string} id - Message ID
 * @property {string} roomId - Room ID
 * @property {string} userId - Target user ID
 * @property {string} content - Message content
 * @property {'ephemeral'} type - Message type
 * @property {number} timestamp - Creation timestamp
 * @property {number} [expiresAt] - Expiration timestamp
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} SendEphemeralOptions
 * @property {string} roomId - Room ID
 * @property {string} userId - Target user ID
 * @property {string} content - Message content
 * @property {number} [ttlMs] - Time-to-live in ms (default: 30000)
 * @property {boolean} [fallbackToDm] - Fall back to DM if user not in room (default: true)
 * @property {Object} [metadata] - Additional metadata
 */

// =============================================================================
// Ephemeral Messages
// =============================================================================

/**
 * Send an ephemeral message to a specific user in a room.
 * @param {import('./types.js').Env} env
 * @param {SendEphemeralOptions} options
 * @returns {Promise<EphemeralMessage | null>}
 */
export async function sendEphemeralMessage(env, options) {
  const {
    roomId,
    userId,
    content,
    ttlMs = 30000,
    fallbackToDm = true,
    metadata = {},
  } = options;

  // Check if user is in the room
  const isMember = await isRoomMember(env, roomId, userId);
  
  if (!isMember && fallbackToDm) {
    // Fall back to DM
    return sendDmFallback(env, {
      userId,
      content,
      metadata,
    });
  }

  if (!isMember && !fallbackToDm) {
    return null;
  }

  // Create ephemeral message
  const message = {
    id: crypto.randomUUID(),
    roomId,
    userId,
    content,
    type: "ephemeral",
    timestamp: Date.now(),
    expiresAt: Date.now() + ttlMs,
    metadata,
  };

  // Store in KV with TTL
  await envKV(env).put(
    `ephemeral:${message.id}`,
    JSON.stringify(message),
    { expirationTtl: Math.ceil(ttlMs / 1000) }
  );

  // Broadcast to the room (only the target user will see it)
  await broadcastEphemeral(env, roomId, message);

  return message;
}

/**
 * Send an ephemeral message to multiple users.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {string[]} userIds
 * @param {string} content
 * @param {{ ttlMs?: number, metadata?: Object }} [options]
 * @returns {Promise<EphemeralMessage[]>}
 */
export async function sendEphemeralToMany(env, roomId, userIds, content, options = {}) {
  const messages = [];
  for (const userId of userIds) {
    const msg = await sendEphemeralMessage(env, {
      roomId,
      userId,
      content,
      ...options,
    });
    if (msg) {
      messages.push(msg);
    }
  }
  return messages;
}

/**
 * Get an ephemeral message by ID.
 * @param {import('./types.js').Env} env
 * @param {string} messageId
 * @returns {Promise<EphemeralMessage | null>}
 */
export async function getEphemeralMessage(env, messageId) {
  const data = await envKV(env).get(`ephemeral:${messageId}`);
  if (!data) return null;

  const message = JSON.parse(data);

  // Check expiration
  if (message.expiresAt && message.expiresAt < Date.now()) {
    await envKV(env).delete(`ephemeral:${messageId}`);
    return null;
  }

  return message;
}

/**
 * Delete an ephemeral message.
 * @param {import('./types.js').Env} env
 * @param {string} messageId
 * @returns {Promise<boolean>}
 */
export async function deleteEphemeralMessage(env, messageId) {
  return envKV(env).delete(`ephemeral:${messageId}`);
}

/**
 * List ephemeral messages for a room.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {{ userId?: string, limit?: number }} [options]
 * @returns {Promise<EphemeralMessage[]>}
 */
export async function listEphemeralMessages(env, roomId, options = {}) {
  const { userId, limit = 100 } = options;

  // In production, you'd use a more efficient approach
  // This is a simplified implementation
  const list = await envKV(env).list({ prefix: "ephemeral:" });
  const messages = [];

  for (const key of list.keys.slice(0, limit)) {
    const data = await envKV(env).get(key.name);
    if (data) {
      const message = JSON.parse(data);
      if (message.roomId === roomId) {
        if (!userId || message.userId === userId) {
          // Check expiration
          if (!message.expiresAt || message.expiresAt > Date.now()) {
            messages.push(message);
          }
        }
      }
    }
  }

  return messages.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Clean up expired ephemeral messages.
 * @param {import('./types.js').Env} env
 * @returns {Promise<number>} Number of cleaned up messages
 */
export async function cleanupEphemeralMessages(env) {
  const list = await envKV(env).list({ prefix: "ephemeral:" });
  let cleaned = 0;

  for (const key of list.keys) {
    const data = await envKV(env).get(key.name);
    if (data) {
      const message = JSON.parse(data);
      if (message.expiresAt && message.expiresAt < Date.now()) {
        await envKV(env).delete(key.name);
        cleaned++;
      }
    }
  }

  return cleaned;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get KV namespace from environment.
 * @param {import('./types.js').Env} env
 * @returns {KVNamespace}
 */
function envKV(env) {
  // In Cloudflare Workers, KV is accessed via env.KV
  return env.KV;
}

/**
 * Check if user is a member of the room.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
async function isRoomMember(env, roomId, userId) {
  const result = await env.DB.prepare(
    `SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?`
  )
    .bind(roomId, userId)
    .first();

  return !!result;
}

/**
 * Send DM fallback when user is not in room.
 * @param {import('./types.js').Env} env
 * @param {{ userId: string, content: string, metadata: Object }} options
 * @returns {Promise<EphemeralMessage>}
 */
async function sendDmFallback(env, options) {
  const { userId, content, metadata } = options;

  // Create DM message
  const message = {
    id: crypto.randomUUID(),
    roomId: `dm:${userId}`,
    userId,
    content,
    type: "ephemeral",
    timestamp: Date.now(),
    expiresAt: Date.now() + 300000, // 5 minutes for DMs
    metadata: { ...metadata, fallback: true },
  };

  // Store in KV
  await envKV(env).put(
    `ephemeral:${message.id}`,
    JSON.stringify(message),
    { expirationTtl: 300 }
  );

  return message;
}

/**
 * Broadcast ephemeral message to the room.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {EphemeralMessage} message
 */
async function broadcastEphemeral(env, roomId, message) {
  try {
    const id = env.ROOM.idFromName(roomId);
    const stub = env.ROOM.get(id);
    await stub.fetch("https://internal/announce", {
      method: "POST",
      body: JSON.stringify({
        type: "ephemeral",
        message,
      }),
    });
  } catch {
    // Ignore broadcast errors
  }
}

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create an ephemeral notification.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {string} userId
 * @param {string} title
 * @param {string} body
 */
export async function sendEphemeralNotification(env, roomId, userId, title, body) {
  return sendEphemeralMessage(env, {
    roomId,
    userId,
    content: `**${title}**\n${body}`,
    metadata: { notification: true },
  });
}

/**
 * Create an ephemeral error message.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {string} userId
 * @param {string} error
 */
export async function sendEphemeralError(env, roomId, userId, error) {
  return sendEphemeralMessage(env, {
    roomId,
    userId,
    content: `⚠️ Error: ${error}`,
    metadata: { error: true },
  });
}

/**
 * Create an ephemeral success message.
 * @param {import('./types.js').Env} env
 * @param {string} roomId
 * @param {string} userId
 * @param {string} message
 */
export async function sendEphemeralSuccess(env, roomId, userId, message) {
  return sendEphemeralMessage(env, {
    roomId,
    userId,
    content: `✅ ${message}`,
    metadata: { success: true },
  });
}
