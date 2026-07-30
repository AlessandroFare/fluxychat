/**
 * Customer-managed keys (CMK) — KV metadata + envelope encryption helpers.
 */

function storeKey(projectId) {
  return `cmk:keys:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readKeys(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(storeKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeKeys(env, projectId, keys) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(storeKey(projectId), JSON.stringify(keys));
}

export async function listCmkKeys(env, { projectId }) {
  const keys = await readKeys(env, projectId);
  return keys.map(({ keyMaterial, ...rest }) => rest);
}

export async function createCmkKey(env, { projectId, algorithm, createdBy }) {
  const keys = await readKeys(env, projectId);
  const keyId = `cmk_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const entry = {
    keyId,
    algorithm: algorithm || "AES-256-GCM",
    status: "active",
    tenantId: projectId,
    createdAt: now,
    createdBy: createdBy ?? null,
    keyMaterial: btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))),
  };
  keys.unshift(entry);
  await writeKeys(env, projectId, keys);
  const { keyMaterial, ...publicEntry } = entry;
  return { key: publicEntry };
}

export async function rotateCmkKey(env, { projectId, keyId, performedBy }) {
  const keys = await readKeys(env, projectId);
  const key = keys.find((k) => k.keyId === keyId);
  if (!key) return { error: "not_found" };
  key.status = "active";
  key.rotatedAt = new Date().toISOString();
  key.rotatedBy = performedBy ?? null;
  key.keyMaterial = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))));
  await writeKeys(env, projectId, keys);
  const { keyMaterial, ...publicEntry } = key;
  return { key: publicEntry };
}

export async function revokeCmkKey(env, { projectId, keyId, performedBy }) {
  const keys = await readKeys(env, projectId);
  const key = keys.find((k) => k.keyId === keyId);
  if (!key) return { error: "not_found" };
  key.status = "revoked";
  key.revokedAt = new Date().toISOString();
  key.revokedBy = performedBy ?? null;
  await writeKeys(env, projectId, keys);
  return { ok: true };
}

export async function encryptWithCmk(env, { projectId, plaintext, performedBy }) {
  const keys = await readKeys(env, projectId);
  const active = keys.find((k) => k.status === "active");
  if (!active) return { error: "no_active_key" };

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const rawKey = Uint8Array.from(atob(active.keyMaterial), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, new TextEncoder().encode(plaintext));

  return {
    keyId: active.keyId,
    algorithm: active.algorithm,
    iv: btoa(String.fromCharCode(...iv)),
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    encryptedBy: performedBy ?? null,
    encryptedAt: new Date().toISOString(),
  };
}
