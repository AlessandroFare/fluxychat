/**
 * P22-F3: Callback URL System
 * Adapted from Vercel Chat SDK's callback-url.ts.
 *
 * Encodes callback tokens in button values for server-side action routing.
 * Uses state adapter for token storage (simpler than HMAC signing).
 *
 * Usage:
 *   const token = await encodeCallbackUrl(env, { url: 'https://example.com/callback' });
 *   const action = await resolveCallbackUrl(env, token);
 */

// =============================================================================
// Constants
// =============================================================================

const CALLBACK_TOKEN_PREFIX = "__cb:";
const CALLBACK_CACHE_KEY_PREFIX = "chat:callback:";
const CALLBACK_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// =============================================================================
// Callback URL System
// =============================================================================

/**
 * Encode a callback value with a token.
 * @param {string} token
 * @returns {string}
 */
export function encodeCallbackValue(token) {
  return `${CALLBACK_TOKEN_PREFIX}${token}`;
}

/**
 * Decode a callback value to extract the token.
 * @param {string | undefined} value
 * @returns {{ callbackToken: string | undefined }}
 */
export function decodeCallbackValue(value) {
  if (!value?.startsWith(CALLBACK_TOKEN_PREFIX)) {
    return { callbackToken: undefined };
  }
  return { callbackToken: value.slice(CALLBACK_TOKEN_PREFIX.length) };
}

/**
 * Generate a random token.
 * @returns {string}
 */
function generateToken() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

/**
 * Process a card to replace callback URLs with tokens.
 * @param {import('./cards.js').CardElement} card
 * @param {import('./types.js').Env} env
 * @returns {Promise<import('./cards.js').CardElement>}
 */
export async function processCardCallbackUrls(card, env) {
  if (!hasCallbackButtons(card.children)) {
    return card;
  }

  return {
    ...card,
    children: await processChildren(card.children, env),
  };
}

/**
 * Check if card has callback buttons.
 * @param {import('./cards.js').CardChild[]} children
 * @returns {boolean}
 */
function hasCallbackButtons(children) {
  for (const child of children) {
    if (child.type === "actions") {
      for (const el of child.children) {
        if (el.type === "button" && el.callbackUrl) {
          return true;
        }
      }
    }
    if (
      child.type === "section" &&
      "children" in child &&
      hasCallbackButtons(child.children)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Process children to replace callback URLs with tokens.
 * @param {import('./cards.js').CardChild[]} children
 * @param {import('./types.js').Env} env
 * @returns {Promise<import('./cards.js').CardChild[]>}
 */
async function processChildren(children, env) {
  const result = [];
  for (const child of children) {
    if (child.type === "actions") {
      result.push(await processActionsElement(child, env));
    } else if (child.type === "section" && "children" in child) {
      result.push({
        ...child,
        children: await processChildren(child.children, env),
      });
    } else {
      result.push(child);
    }
  }
  return result;
}

/**
 * Process actions element to replace callback URLs with tokens.
 * @param {import('./cards.js').ActionsElement} actions
 * @param {import('./types.js').Env} env
 * @returns {Promise<import('./cards.js').ActionsElement>}
 */
async function processActionsElement(actions, env) {
  return {
    type: "actions",
    children: await Promise.all(
      actions.children.map(async (el) => {
        if (el.type !== "button" || !el.callbackUrl) {
          return el;
        }

        const token = generateToken();
        const stored = {
          url: el.callbackUrl,
          originalValue: el.value,
        };

        // Store in D1
        await env.DB.prepare(
          `INSERT INTO callback_tokens (token, data, expires_at)
           VALUES (?, ?, ?)
           ON CONFLICT(token) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`
        )
          .bind(token, JSON.stringify(stored), Date.now() + CALLBACK_TTL_MS)
          .run();

        return {
          type: "button",
          id: el.id,
          label: el.label,
          style: el.style,
          disabled: el.disabled,
          value: encodeCallbackValue(token),
          actionType: el.actionType,
        };
      })
    ),
  };
}

/**
 * Resolve a callback token to its URL and original value.
 * @param {import('./types.js').Env} env
 * @param {string} token
 * @returns {Promise<{ url: string; originalValue?: string } | null>}
 */
export async function resolveCallbackUrl(env, token) {
  const result = await env.DB.prepare(
    `SELECT data FROM callback_tokens WHERE token = ? AND expires_at > ?`
  )
    .bind(token, Date.now())
    .first();

  if (!result) {
    return null;
  }

  const stored = JSON.parse(result.data);
  return stored;
}

/**
 * Post to a callback URL with payload.
 * @param {string} callbackUrl
 * @param {Record<string, unknown>} payload
 * @returns {Promise<{ error?: unknown; status?: number }>}
 */
export async function postToCallbackUrl(callbackUrl, payload) {
  try {
    const response = await fetch(callbackUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      return {
        error: new Error(
          `Callback URL returned ${response.status}: ${await response.text().catch(() => "")}`
        ),
        status: response.status,
      };
    }
    return { status: response.status };
  } catch (error) {
    return { error };
  }
}

/**
 * Clean up expired callback tokens.
 * @param {import('./types.js').Env} env
 * @returns {Promise<number>}
 */
export async function cleanupCallbackTokens(env) {
  const result = await env.DB.prepare(
    `DELETE FROM callback_tokens WHERE expires_at < ?`
  )
    .bind(Date.now())
    .run();

  return result.meta?.changes || 0;
}
