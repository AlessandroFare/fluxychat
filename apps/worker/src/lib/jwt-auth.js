import { isValidId } from "./valid-ids.js";

/** Fixed-length dummy key so unknown-project verification runs comparable crypto work (timing mitigation). */
const JWT_DUMMY_KEY_BYTES = new Uint8Array(32);

async function importHmacKey(secretBytes) {
  return crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

async function verifyHs256Signature(headerB64, payloadB64, sigB64, secretBytes) {
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  let sig;
  try {
    sig = base64urlToBytes(sigB64);
  } catch {
    return false;
  }
  const key = await importHmacKey(secretBytes);
  return crypto.subtle.verify("HMAC", key, sig, data);
}

export function base64urlToBytes(b64url) {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export function base64urlEncode(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Verify HS256 project JWT. Always runs signature verification (with a dummy key when the project
 * has no stored secret) so "unknown project" is not a fast path vs "bad signature" (P1-2 timing).
 * Failures after cryptographic checks use a generic 401 body.
 */
export async function verifyJwtAndGetContext(request, env, opts = {}) {
  const logInfo = typeof opts.logInfo === "function" ? opts.logInfo : () => {};

  const authHeader = request.headers.get("Authorization");
  const url = new URL(request.url);
  const token =
    (authHeader && authHeader.startsWith("Bearer ") && authHeader.slice(7)) ||
    url.searchParams.get("token");

  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Response("Invalid token", { status: 401 });
  }

  const [headerB64, payloadB64, sigB64] = parts;
  let payloadJson;
  try {
    payloadJson = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payloadB64))
    );
  } catch {
    throw new Response("Invalid token", { status: 401 });
  }

  // Audit fix M-3: reject tokens without an `exp` claim (infinite lifetime).
  // All legitimate minting paths (/auth/token, API key flow) set exp; a token
  // without exp is either misconfigured or adversarial.
  if (!payloadJson.exp) {
    throw new Response("Token missing exp claim", { status: 401 });
  }
  if (Date.now() / 1000 > payloadJson.exp) {
    throw new Response("Token expired", { status: 401 });
  }

  const { sub: userId, tid: projectId, roles = [] } = payloadJson;
  if (!userId || !projectId || !isValidId(userId) || !isValidId(projectId)) {
    throw new Response("Unauthorized", { status: 401 });
  }

  if (opts.expectedProjectId && projectId !== opts.expectedProjectId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Constant-time crypto before DB lookup (P1-2): unknown vs known project both verify once.
  await verifyHs256Signature(headerB64, payloadB64, sigB64, JWT_DUMMY_KEY_BYTES);

  const row = await env.DB.prepare(
    "SELECT jwt_secret FROM project_secrets WHERE project_id = ?"
  )
    .bind(projectId)
    .first();

  const hasStoredSecret =
    row &&
    typeof row.jwt_secret === "string" &&
    row.jwt_secret.length > 0;

  if (!hasStoredSecret) {
    throw new Response("Unauthorized", { status: 401 });
  }

  let ok = await verifyHs256Signature(
    headerB64,
    payloadB64,
    sigB64,
    new TextEncoder().encode(row.jwt_secret)
  );

  if (!ok && env.JWT_SECRET_PREVIOUS) {
    try {
      // Audit S-31: enforce a max age for the previous secret. Without
      // this, a leaked old key remains usable forever. Operators should
      // set JWT_SECRET_PREVIOUS_EXPIRES_AT (ISO timestamp); after that
      // point the previous secret is no longer accepted.
      const retireAt = env.JWT_SECRET_PREVIOUS_EXPIRES_AT;
      const ts = retireAt ? Date.parse(String(retireAt)) : NaN;
      const expired = Number.isFinite(ts) && Date.now() > ts;
      if (retireAt && expired) {
        logInfo("jwt.legacy_secret_expired", { userId, projectId, retireAt });
        // fall through to generic rejection below
      } else {
        const prevOk = await verifyHs256Signature(
          headerB64,
          payloadB64,
          sigB64,
          new TextEncoder().encode(env.JWT_SECRET_PREVIOUS),
        );
        if (prevOk) {
          if (retireAt && !expired) {
            logInfo("jwt.legacy_secret_used", { userId, projectId, retireAt });
          } else {
            // No expiration set  accept but log a warning so operators
            // see it in their logs.
            logInfo("jwt.legacy_secret_used_no_expire_at", { userId, projectId });
          }
          return {
            userId,
            projectId,
            roles,
            ...(payloadJson.roomId ? { roomId: payloadJson.roomId } : {}),
          };
        }
      }
    } catch {
      // fall through to generic rejection
    }
  }

  if (!ok) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return {
    userId,
    projectId,
    roles,
    ...(payloadJson.roomId ? { roomId: payloadJson.roomId } : {}),
  };
}
