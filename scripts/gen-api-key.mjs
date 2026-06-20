/**
 * One-time script: generates a new API key + its hashes for inserting into D1.
 * Usage: node scripts/gen-api-key.mjs <API_KEY_HASH_SALT>
 *
 * The salt comes from your Cloudflare Worker env (API_KEY_HASH_SALT).
 * If it's not set (dev only), omit the arg and it uses the dev fallback.
 */
const salt = process.argv[2] || "fluxy-default-salt-rotate-in-prod";

const projectId = "proj_" + crypto.randomUUID().replace(/-/g, "").slice(0, 12);
const rawKey = "fc_" + crypto.randomUUID().replace(/-/g, "");

// Legacy SHA-256
const legacyDigest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawKey));
const legacyHash = Array.from(new Uint8Array(legacyDigest))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

// HMAC-SHA-256
const data = new TextEncoder().encode(`fc-apikey:${salt}:${rawKey}`);
const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(salt), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const sig = await crypto.subtle.sign("HMAC", key, data);
const hmacHash = Array.from(new Uint8Array(sig))
  .map((b) => b.toString(16).padStart(2, "0"))
  .join("");

const keyPrefix = rawKey.slice(0, 14) + "...";
const jwtSecret = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
const now = new Date().toISOString();

console.log("\n=== SAVE THIS API KEY (shown once) ===");
console.log(rawKey);
console.log("======================================\n");

console.log("--- Paste these SQL statements into Cloudflare D1 Console ---\n");

console.log(`INSERT INTO projects (id, name, created_at) VALUES ('${projectId}', 'Fluxychat Platform', '${now}');`);

console.log(`INSERT INTO api_keys (id, project_id, key_prefix, key_hash, key_hmac, created_at)
VALUES ('ak_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}', '${projectId}', '${keyPrefix}', '${legacyHash}', '${hmacHash}', '${now}');`);

console.log(`INSERT INTO project_secrets (project_id, jwt_secret, created_at) VALUES ('${projectId}', '${jwtSecret}', '${now}');`);

console.log("\n--- Then set these on Vercel ---");
console.log(`FLUXY_CONSOLE_API_KEY = ${rawKey}`);
console.log(`FLUXY_PLATFORM_PROJECT_ID = ${projectId}`);
console.log(`NEXT_PUBLIC_FLUXY_PLATFORM_PROJECT_ID = ${projectId}`);
