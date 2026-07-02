/**
 * P26-A-5: reviver() for JSON.parse with _type discriminator
 * Adapted from Vercel Chat SDK's reviver.ts.
 *
 * A JSON.parse reviver function that automatically deserializes
 * FluxyChat objects from plain JSON. Useful for workflow engines,
 * D1 storage round-trips, and external system serialization.
 *
 * Handles:
 * - `fluxy:Thread` → ThreadRef instance
 * - `fluxy:Message` → Message-like object with Date fields restored
 * - `fluxy:Card` → Card object (plain data, no class needed)
 *
 * @example
 * ```js
 * import { parseChatJSON, reviver } from "./reviver.js";
 *
 * // Using parseChatJSON helper
 * const data = parseChatJSON(jsonString);
 * // data.thread is now a ThreadRef instance
 *
 * // Using reviver directly with JSON.parse
 * const data = JSON.parse(jsonString, reviver);
 * ```
 */

import { ThreadRef } from "./chat-api.js";

// =============================================================================
// Reviver
// =============================================================================

/**
 * JSON.parse reviver that auto-deserializes FluxyChat objects.
 *
 * Detects objects with a `_type` discriminator field and reconstructs
 * the appropriate class instance.
 *
 * @param {string} _key - JSON key (unused)
 * @param {unknown} value - Parsed value
 * @returns {unknown} Deserialized value
 */
export function reviver(_key, value) {
  if (value && typeof value === "object" && "_type" in value) {
    const typed = /** @type {{ _type: string }} */ (value);

    switch (typed._type) {
      case "fluxy:Thread":
        return ThreadRef.fromJSON(value);

      case "fluxy:Message":
        return reviveMessage(value);

      case "fluxy:Card":
        return reviveCard(value);

      default:
        // Unknown _type — return as-is
        return value;
    }
  }

  // Restore Date fields for objects with ISO date strings
  // Skip arrays — spread would convert them to objects
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return reviveDates(value);
  }

  return value;
}

// =============================================================================
// Message Reviver
// =============================================================================

/**
 * Revive a serialized Message object.
 * Restores Date instances for metadata fields.
 * @param {Record<string, unknown>} value
 * @returns {Record<string, unknown>}
 */
function reviveMessage(value) {
  const obj = { ...value };

  // Restore Date fields
  if (obj.metadata) {
    const meta = { ...obj.metadata };
    if (meta.dateSent && typeof meta.dateSent === "string") {
      meta.dateSent = new Date(meta.dateSent);
    }
    if (meta.editedAt && typeof meta.editedAt === "string") {
      meta.editedAt = new Date(meta.editedAt);
    }
    obj.metadata = meta;
  }

  // Ensure arrays exist
  if (!obj.attachments) obj.attachments = [];
  if (!obj.links) obj.links = [];

  return obj;
}

// =============================================================================
// Card Reviver
// =============================================================================

/**
 * Revive a serialized Card object.
 * Cards are plain data objects — no class instance needed.
 * @param {Record<string, unknown>} value
 * @returns {Record<string, unknown>}
 */
function reviveCard(value) {
  // Cards are plain data, just ensure structure
  return { ...value };
}

// =============================================================================
// Date Reviver
// =============================================================================

/** ISO date string regex */
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Scan an object for ISO date strings and convert them to Date instances.
 * Only converts fields that look like dates (createdAt, updatedAt, etc.)
 * @param {Record<string, unknown>} obj
 * @returns {Record<string, unknown>}
 */
function reviveDates(obj) {
  const dateFields = [
    "createdAt",
    "updatedAt",
    "deletedAt",
    "editedAt",
    "dateSent",
    "expiresAt",
    "sendAt",
    "lastReplyAt",
  ];

  const result = { ...obj };
  for (const field of dateFields) {
    const val = result[field];
    if (typeof val === "string" && ISO_DATE_REGEX.test(val)) {
      result[field] = new Date(val);
    }
  }

  return result;
}

// =============================================================================
// parseChatJSON Helper
// =============================================================================

/**
 * Parse a JSON string with automatic FluxyChat object deserialization.
 *
 * @param {string} jsonString - JSON string to parse
 * @returns {unknown} Parsed data with revived objects
 *
 * @example
 * ```js
 * const data = parseChatJSON('{"thread":{"_type":"fluxy:Thread","id":"web:room-1:msg-1","adapterSlug":"web"}}');
 * // data.thread is a ThreadRef instance
 * console.log(data.thread.id); // "web:room-1:msg-1"
 * ```
 */
export function parseChatJSON(jsonString) {
  return JSON.parse(jsonString, reviver);
}
