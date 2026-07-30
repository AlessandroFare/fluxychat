/**
 * CRM / Helpdesk adapters — KV-backed connection configs + sync stubs.
 * Providers: salesforce, zendesk, hubspot, intercom
 */

const PROVIDERS = ["salesforce", "zendesk", "hubspot", "intercom"];

function connectionsKey(projectId) {
  return `crm:connections:${projectId}`;
}

function syncLogKey(projectId) {
  return `crm:sync:${projectId}`;
}

function contactsCacheKey(projectId, provider) {
  return `crm:contacts:${projectId}:${provider}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readConnections(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(connectionsKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeConnections(env, projectId, connections) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(connectionsKey(projectId), JSON.stringify(connections));
}

async function appendSyncLog(env, projectId, entry) {
  const kv = getKv(env);
  if (!kv) return;
  const raw = await kv.get(syncLogKey(projectId));
  let log = [];
  if (raw) {
    try {
      log = JSON.parse(raw);
      if (!Array.isArray(log)) log = [];
    } catch {
      log = [];
    }
  }
  log.unshift(entry);
  if (log.length > 100) log.length = 100;
  await kv.put(syncLogKey(projectId), JSON.stringify(log));
}

function maskSecret(value) {
  if (!value || value.length < 8) return value ? "••••" : null;
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function publicConnection(row) {
  return {
    provider: row.provider,
    instanceUrl: row.instanceUrl ?? null,
    enabled: row.enabled !== false,
    webhookSecret: row.webhookSecret ? "••••" : null,
    apiKey: maskSecret(row.apiKey),
    lastSyncAt: row.lastSyncAt ?? null,
    updatedAt: row.updatedAt,
  };
}

export async function listCrmConnections(env, { projectId }) {
  const connections = await readConnections(env, projectId);
  return connections.map(publicConnection);
}

export async function upsertCrmConnection(env, { projectId, provider, apiKey, instanceUrl, webhookSecret, enabled }) {
  if (!PROVIDERS.includes(provider)) return { error: `provider must be one of: ${PROVIDERS.join(", ")}` };
  const connections = await readConnections(env, projectId);
  const now = new Date().toISOString();
  const existing = connections.find((c) => c.provider === provider);
  const entry = {
    provider,
    apiKey: apiKey ?? existing?.apiKey ?? "",
    instanceUrl: instanceUrl ?? existing?.instanceUrl ?? null,
    webhookSecret: webhookSecret ?? existing?.webhookSecret ?? null,
    enabled: enabled !== undefined ? enabled : (existing?.enabled ?? true),
    lastSyncAt: existing?.lastSyncAt ?? null,
    updatedAt: now,
  };
  const next = connections.filter((c) => c.provider !== provider);
  next.unshift(entry);
  await writeConnections(env, projectId, next);
  return { connection: publicConnection(entry) };
}

export async function syncCrmConnection(env, { projectId, provider, direction }) {
  const connections = await readConnections(env, projectId);
  const conn = connections.find((c) => c.provider === provider);
  if (!conn) return { error: "connection_not_found" };
  const dir = ["in", "out", "bidirectional"].includes(direction) ? direction : "bidirectional";
  const now = new Date().toISOString();
  const contactsSynced = dir === "out" ? 0 : Math.floor(Math.random() * 5) + 1;
  const ticketsSynced = dir === "in" ? 0 : Math.floor(Math.random() * 3);
  conn.lastSyncAt = now;
  conn.updatedAt = now;
  await writeConnections(env, projectId, connections);

  const kv = getKv(env);
  if (kv && contactsSynced > 0) {
    const cached = [
      { id: `${provider}_contact_1`, name: "Demo Contact", email: "demo@example.com", externalId: `${provider}-001` },
    ];
    await kv.put(contactsCacheKey(projectId, provider), JSON.stringify(cached));
  }

  const result = {
    provider,
    direction: dir,
    contactsSynced,
    ticketsSynced,
    errors: [],
    syncedAt: now,
  };
  await appendSyncLog(env, projectId, result);
  return result;
}

export async function listCrmSyncHistory(env, { projectId, limit = 20 }) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(syncLogKey(projectId));
  if (!raw) return [];
  try {
    const log = JSON.parse(raw);
    return Array.isArray(log) ? log.slice(0, limit) : [];
  } catch {
    return [];
  }
}

export async function lookupCrmContact(env, { projectId, provider, email, externalId }) {
  const kv = getKv(env);
  if (!kv) return null;
  const raw = await kv.get(contactsCacheKey(projectId, provider));
  if (!raw) return null;
  try {
    const contacts = JSON.parse(raw);
    if (!Array.isArray(contacts)) return null;
    if (email) return contacts.find((c) => c.email === email) ?? null;
    if (externalId) return contacts.find((c) => c.externalId === externalId) ?? null;
    return contacts[0] ?? null;
  } catch {
    return null;
  }
}

export async function createCrmTicket(env, { projectId, provider, subject, description, contactEmail, priority }) {
  const connections = await readConnections(env, projectId);
  const conn = connections.find((c) => c.provider === provider);
  if (!conn) return { error: "connection_not_found" };
  const id = `ticket_${crypto.randomUUID().slice(0, 10)}`;
  return {
    ticket: {
      id,
      provider,
      subject: subject?.trim() || "Support request",
      description: description?.trim() || "",
      status: "open",
      priority: priority || "medium",
      contactEmail: contactEmail || null,
      externalId: `${provider}_${id}`,
      createdAt: new Date().toISOString(),
    },
  };
}

export async function handoffToAgent(env, { projectId, provider, ticketId, roomId, agentId }) {
  if (!roomId || !agentId) return { error: "roomId and agentId required" };
  const connections = await readConnections(env, projectId);
  const conn = connections.find((c) => c.provider === provider);
  if (!conn) return { error: "connection_not_found" };
  return {
    handoff: {
      ticketId,
      roomId,
      agentId,
      provider,
      status: "handoff_pending",
      createdAt: new Date().toISOString(),
    },
  };
}
