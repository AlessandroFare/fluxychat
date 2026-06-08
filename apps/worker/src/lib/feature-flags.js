/**
 * Cloudflare Flagship feature flags (P12-J).
 * Falls back to legacy env vars when `env.FLAGS` is not bound.
 */

/** @typedef {{ userId?: string, projectId?: string, roomId?: string, email?: string }} FeatureFlagContext */

export const FEATURE_FLAG_KEYS = {
  VOICE_MESSAGES: "voice_messages",
  REPLY_SUGGESTIONS: "reply_suggestions",
  EMBED_WIDGET: "embed_widget",
  RECONNECT_BACKOFF_FLUXY: "reconnect_backoff_fluxy",
};

const BOOLEAN_FLAGS = [
  FEATURE_FLAG_KEYS.VOICE_MESSAGES,
  FEATURE_FLAG_KEYS.REPLY_SUGGESTIONS,
  FEATURE_FLAG_KEYS.EMBED_WIDGET,
  FEATURE_FLAG_KEYS.RECONNECT_BACKOFF_FLUXY,
];

/**
 * @param {*} env
 * @param {string | undefined} key
 */
function readEnvTruthy(env, key) {
  if (!key) return null;
  const value = env[key];
  if (value === undefined || value === null || String(value).trim() === "") {
    return null;
  }
  return value !== "false" && value !== "0";
}

/**
 * @param {*} env
 * @param {string} flagKey
 */
export function envFallbackBoolean(flagKey, env) {
  switch (flagKey) {
    case FEATURE_FLAG_KEYS.VOICE_MESSAGES:
      return (
        readEnvTruthy(env, "FEATURE_VOICE_MESSAGES") ??
        readEnvTruthy(env, "VOICE_MESSAGES_ENABLED") ??
        true
      );
    case FEATURE_FLAG_KEYS.REPLY_SUGGESTIONS:
      return readEnvTruthy(env, "FEATURE_REPLY_SUGGESTIONS") ?? true;
    case FEATURE_FLAG_KEYS.EMBED_WIDGET:
      return env.EMBED_WIDGET_ENABLED !== "false" && env.EMBED_WIDGET_ENABLED !== "0";
    case FEATURE_FLAG_KEYS.RECONNECT_BACKOFF_FLUXY:
      return readEnvTruthy(env, "FEATURE_RECONNECT_BACKOFF_FLUXY") ?? false;
    default:
      return false;
  }
}

/**
 * @param {FeatureFlagContext} [context]
 */
export function buildFlagEvaluationContext(context = {}) {
  /** @type {Record<string, string>} */
  const out = {};
  if (context.userId) out.userId = String(context.userId);
  if (context.projectId) out.projectId = String(context.projectId);
  if (context.roomId) out.roomId = String(context.roomId);
  if (context.email) out.email = String(context.email);
  return out;
}

/**
 * @param {*} env
 */
export function isFlagshipConfigured(env) {
  return Boolean(env?.FLAGS?.getBooleanValue);
}

/**
 * @param {*} env
 * @param {string} flagKey
 * @param {{ defaultValue?: boolean, context?: FeatureFlagContext }} [options]
 */
export async function getFeatureFlagBoolean(env, flagKey, options = {}) {
  const defaultValue = options.defaultValue ?? envFallbackBoolean(flagKey, env);
  const evalContext = buildFlagEvaluationContext(options.context);

  if (env?.FLAGS?.getBooleanValue) {
    try {
      return await env.FLAGS.getBooleanValue(flagKey, defaultValue, evalContext);
    } catch {
      return defaultValue;
    }
  }

  return defaultValue;
}

/**
 * @param {*} env
 * @param {FeatureFlagContext} [context]
 */
export async function getClientFeatureFlags(env, context = {}) {
  /** @type {Record<string, boolean>} */
  const flags = {};
  for (const key of BOOLEAN_FLAGS) {
    flags[key] = await getFeatureFlagBoolean(env, key, { context });
  }
  return flags;
}

/**
 * @param {*} env
 * @param {string} flagKey
 * @param {FeatureFlagContext} [context]
 */
export async function requireFeatureFlag(env, flagKey, context) {
  const enabled = await getFeatureFlagBoolean(env, flagKey, { context });
  if (!enabled) {
    return { ok: false, error: "feature_disabled", flag: flagKey };
  }
  return { ok: true };
}
