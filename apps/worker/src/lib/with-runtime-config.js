/**
 * Workers Free allows 64 env bindings (secrets + text vars). Hosted Fluxy
 * outgrew that by putting flags in individual secrets. Pack non-secret
 * knobs into one secret `FLUXY_RUNTIME_JSON` (JSON object of string values).
 * Real secrets on the Worker always win over the JSON blob.
 */
export function withRuntimeConfig(env) {
  if (!env || typeof env !== "object") return env;
  const raw = env.FLUXY_RUNTIME_JSON;
  if (typeof raw !== "string" || !raw.trim()) return env;
  let extra;
  try {
    extra = JSON.parse(raw);
  } catch {
    return env;
  }
  if (!extra || typeof extra !== "object" || Array.isArray(extra)) return env;

  return new Proxy(env, {
    get(target, prop, receiver) {
      const own = Reflect.get(target, prop, receiver);
      if (own !== undefined && own !== null && own !== "") return own;
      if (typeof prop === "string" && Object.prototype.hasOwnProperty.call(extra, prop)) {
        return extra[prop];
      }
      return own;
    },
  });
}
