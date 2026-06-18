// VAPID (Voluntary Application Server Identification) helper.
// RFC 8292 — Web Push Voluntary Application Server Identification.
// Generates a per-project EC P-256 key pair on first use, stores the
// JWK-formatted public/private in D1 (`project_vapid_keys`) and exposes the
// base64url-encoded public key to the client via /push/web/vapid-public-key.

const SUBJECT_DEFAULT = "mailto:admin@fluxychat.local";

function base64UrlEncode(bytes) {
  let str = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const b of arr) str += String.fromCharCode(b);
  const b64 = btoa(str);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecodeToBytes(input) {
  const pad = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const str = atob(b64);
  const out = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) out[i] = str.charCodeAt(i);
  return out;
}

async function exportJwk(key) {
  return crypto.subtle.exportKey("jwk", key);
}

async function importPrivateJwk(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign"]
  );
}

async function importPublicJwk(jwk) {
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/**
 * Generate a new VAPID P-256 key pair and return { publicKey, privateKey } as JWK.
 * @returns {Promise<{ publicKey: JsonWebKey, privateKey: JsonWebKey }>}
 */
export async function generateVapidKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKey = await exportJwk(keyPair.publicKey);
  const privateKey = await exportJwk(keyPair.privateKey);
  return { publicKey, privateKey };
}

/**
 * Get (or auto-create) the VAPID key pair for a project.
 * @param {*} env Worker env
 * @param {string} projectId
 * @param {{ subject?: string }} [opts]
 */
export async function getOrCreateVapidKeyPair(env, projectId, opts = {}) {
  if (!env?.DB || !projectId) {
    throw new Error("vapid_unavailable");
  }
  const row = await env.DB.prepare(
    "SELECT public_key, private_key, subject FROM project_vapid_keys WHERE project_id = ?"
  )
    .bind(projectId)
    .first();
  if (row) {
    return {
      publicKey: JSON.parse(row.public_key),
      privateKey: JSON.parse(row.private_key),
      subject: row.subject || SUBJECT_DEFAULT,
    };
  }
  const { publicKey, privateKey } = await generateVapidKeyPair();
  const subject = opts.subject || env.VAPID_SUBJECT || SUBJECT_DEFAULT;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT OR IGNORE INTO project_vapid_keys
      (project_id, public_key, private_key, subject, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
    .bind(
      projectId,
      JSON.stringify(publicKey),
      JSON.stringify(privateKey),
      subject,
      now,
      now
    )
    .run();
  // Re-read in case another request raced us.
  const re = await env.DB.prepare(
    "SELECT public_key, private_key, subject FROM project_vapid_keys WHERE project_id = ?"
  )
    .bind(projectId)
    .first();
  if (re) {
    return {
      publicKey: JSON.parse(re.public_key),
      privateKey: JSON.parse(re.private_key),
      subject: re.subject || subject,
    };
  }
  return { publicKey, privateKey, subject };
}

/**
 * Get the public key as base64url-encoded raw 65-byte uncompressed point.
 * (RFC 8292 §2: the "applicationServerKey" passed to PushManager.subscribe.)
 * @param {JsonWebKey} publicJwk
 */
export async function getVapidPublicKeyRaw(publicJwk) {
  const key = await importPublicJwk(publicJwk);
  const raw = await crypto.subtle.exportKey("raw", key);
  return base64UrlEncode(new Uint8Array(raw));
}

/**
 * Build the VAPID `Authorization` JWT header (RFC 8292 §2 / RFC 7519).
 * @param {JsonWebKey} privateJwk
 * @param {string} audience  Origin of the push endpoint (e.g. "https://fcm.googleapis.com")
 * @param {string} subject
 * @param {number} [ttlSeconds=12*3600]
 */
export async function buildVapidJwt(privateJwk, audience, subject, ttlSeconds = 12 * 3600) {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + ttlSeconds,
    iat: now,
    sub: subject,
  };
  const enc = (obj) => base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const signingInput = `${enc(header)}.${enc(payload)}`;
  const key = await importPrivateJwk(privateJwk);
  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput)
  );
  // Convert ASN.1 DER signature to raw r||s (P-1363) for ES256 JWS.
  const raw = derToJoseEs256(new Uint8Array(sigBuf));
  return `${signingInput}.${base64UrlEncode(raw)}`;
}

/**
 * Convert an ASN.1 DER ECDSA signature to JOSE raw r||s.
 * DER layout: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
 * In environments where WebCrypto returns raw r||s (e.g. Node 18+), the
 * input is 64 bytes and we just return it as-is after length normalization.
 */
function derToJoseEs256(der) {
  if (der.length === 64) {
    // Already raw r||s (some implementations skip DER encoding).
    const out = new Uint8Array(64);
    out.set(der, 0);
    return out;
  }
  if (der.length < 8 || der[0] !== 0x30) {
    throw new Error("vapid_signature_der_invalid");
  }
  let offset = 2;
  if (der[1] & 0x80) {
    offset += der[1] & 0x7f;
  }
  if (der[offset] !== 0x02) throw new Error("vapid_signature_der_invalid");
  offset++;
  let rLen = der[offset];
  offset++;
  if (rLen & 0x80) {
    const n = rLen & 0x7f;
    rLen = 0;
    for (let i = 0; i < n; i++) rLen = (rLen << 8) | der[offset + i];
    offset += n;
  }
  let r = der.slice(offset, offset + rLen);
  offset += rLen;
  if (der[offset] !== 0x02) throw new Error("vapid_signature_der_invalid");
  offset++;
  let sLen = der[offset];
  offset++;
  if (sLen & 0x80) {
    const n = sLen & 0x7f;
    sLen = 0;
    for (let i = 0; i < n; i++) sLen = (sLen << 8) | der[offset + i];
    offset += n;
  }
  let s = der.slice(offset, offset + sLen);
  r = trimLeadingZeros(r, 32);
  s = trimLeadingZeros(s, 32);
  const out = new Uint8Array(64);
  out.set(r, 32 - r.length);
  out.set(s, 64 - s.length);
  return out;
}

function trimLeadingZeros(buf, targetLen) {
  let i = 0;
  while (i < buf.length - 1 && buf[i] === 0) i++;
  const trimmed = buf.slice(i);
  if (trimmed.length > targetLen) return trimmed.slice(trimmed.length - targetLen);
  return trimmed;
}

/**
 * Encrypt a Web Push payload using ECDH-ES + AES-128-GCM (RFC 8188).
 * @param {string} plaintext
 * @param {string} p256dhB64Url  Subscriber public key (raw, 65 bytes)
 * @param {string} authB64Url    16-byte shared secret (base64url)
 */
export async function encryptWebPushPayload(plaintext, p256dhB64Url, authB64Url) {
  const subscriberPub = await crypto.subtle.importKey(
    "raw",
    base64UrlDecodeToBytes(p256dhB64Url),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const localEcdh = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const sharedBits = await crypto.subtle.deriveBits(
    { name: "ECDH", public: subscriberPub },
    localEcdh.privateKey,
    256
  );
  const authSecret = base64UrlDecodeToBytes(authB64Url);
  const ecdhPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", localEcdh.publicKey)
  );

  // RFC 8291 §3.1 — salt = 16 random bytes
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyInfo = buildWebPushInfo("aesgcm", ecdhPub, p256dhB64Url);
  const ikm = await hkdfExtractAndExpand(sharedBits, authSecret, keyInfo, 32);
  const cekInfo = concatBytes(
    new TextEncoder().encode("Content-Encoding: aes-128-gcm\0"),
    new Uint8Array([0x01])
  );
  const cek = await hkdfExtractAndExpand(ikm, salt, cekInfo, 16);
  const nonceInfo = concatBytes(
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    new Uint8Array([0x01])
  );
  const nonce = await hkdfExtractAndExpand(ikm, salt, nonceInfo, 12);

  const plaintextBytes =
    typeof plaintext === "string"
      ? new TextEncoder().encode(plaintext)
      : plaintext;
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes, 0);
  padded[plaintextBytes.length] = 0x02; // final delimiter per RFC 8188

  const key = await crypto.subtle.importKey(
    "raw",
    cek,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, padded)
  );
  // Header: salt(16) || rs(4 big-endian) || idlen(1) || keyid
  const rs = 4096;
  const header = new Uint8Array(16 + 4 + 1);
  header.set(salt, 0);
  header.set(new Uint8Array([(rs >>> 24) & 0xff, (rs >>> 16) & 0xff, (rs >>> 8) & 0xff, rs & 0xff]), 16);
  header[20] = ecdhPub.length;
  const full = concatBytes(header, ecdhPub, ciphertext);
  return {
    ciphertext: full,
    encoding: "aes128gcm",
    salt,
    rs,
    ecdhPublic: ecdhPub,
  };
}

function buildWebPushInfo(label, ecdhPub, p256dhB64Url) {
  // "WebPush: info\0" || ua_public || as_public (both as raw 65-byte uncompressed points)
  const prefix = new TextEncoder().encode(`WebPush: info\0`);
  return concatBytes(prefix, ecdhPub, base64UrlDecodeToBytes(p256dhB64Url));
}

function concatBytes(...arrays) {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrays) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

async function hkdfExtractAndExpand(secret, salt, info, length) {
  const ikmBytes = secret instanceof ArrayBuffer ? new Uint8Array(secret) : secret;
  const saltBytes = salt instanceof ArrayBuffer ? new Uint8Array(salt) : salt;
  const ikmKey = await crypto.subtle.importKey(
    "raw",
    ikmBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prkBuf = await crypto.subtle.sign("HMAC", ikmKey, saltBytes);
  const prkKey = await crypto.subtle.importKey(
    "raw",
    prkBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  let t = new Uint8Array(0);
  const out = new Uint8Array(length);
  let pos = 0;
  let counter = 1;
  while (pos < length) {
    const nextInput = concatBytes(t, info, new Uint8Array([counter]));
    t = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, nextInput));
    const slice = t.slice(0, Math.min(t.length, length - pos));
    out.set(slice, pos);
    pos += slice.length;
    counter++;
  }
  return out;
}

/**
 * Map common HTTP status codes from a push service to a triage action.
 * 201/202 = success, 404/410 = unsubscribe (RFC 8030 §7.3), 401/403/400 = re-check config.
 */
export function classifyPushResponse(status) {
  if (status === 201 || status === 202) return "delivered";
  if (status === 404 || status === 410) return "gone";
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 401 || status === 403) return "config_error";
  if (status >= 500) return "transient";
  return "unknown";
}

