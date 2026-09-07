/**
 * Project-scoped app manifests (console Marketplace Apps tab).
 */

function appsKey(projectId) {
  return `marketplace-apps:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readApps(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(appsKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeApps(env, projectId, apps) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(appsKey(projectId), JSON.stringify(apps));
}

function sanitizePermissions(raw) {
  if (!Array.isArray(raw)) return ["chat:write"];
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => /^[a-z0-9:_-]{1,64}$/i.test(item))
    .slice(0, 12);
}

export async function listProjectApps(env, { projectId }) {
  return readApps(env, projectId);
}

export async function publishProjectApp(env, { projectId, name, description, permissions, publisherId }) {
  const trimmed = String(name || "").trim().slice(0, 80);
  if (!trimmed) return { error: "name_required" };
  const apps = await readApps(env, projectId);
  const app = {
    appId: `app-${crypto.randomUUID()}`,
    name: trimmed,
    version: "1.0.0",
    description: String(description || "").trim().slice(0, 500),
    permissions: sanitizePermissions(permissions),
    publisherId: publisherId || null,
    createdAt: Date.now(),
  };
  apps.unshift(app);
  await writeApps(env, projectId, apps.slice(0, 100));
  return { app };
}

export async function deleteProjectApp(env, { projectId, appId }) {
  const apps = await readApps(env, projectId);
  const next = apps.filter((app) => app.appId !== appId);
  await writeApps(env, projectId, next);
  return { deleted: apps.length - next.length };
}
