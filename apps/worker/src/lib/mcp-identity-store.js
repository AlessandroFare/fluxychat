/**
 * MCP server identity, instructions, tool provenance, and audit log (KV).
 */

function registryKey(projectId) {
  return `mcp-id:${projectId}`;
}

function auditKey(projectId) {
  return `mcp-audit:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readRegistry(env, projectId) {
  const kv = getKv(env);
  if (!kv) return { servers: [], tools: [] };
  const raw = await kv.get(registryKey(projectId));
  if (!raw) return { servers: [], tools: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      servers: Array.isArray(parsed.servers) ? parsed.servers : [],
      tools: Array.isArray(parsed.tools) ? parsed.tools : [],
    };
  } catch {
    return { servers: [], tools: [] };
  }
}

async function writeRegistry(env, projectId, registry) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(registryKey(projectId), JSON.stringify(registry));
}

async function readAudit(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(auditKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function appendAudit(env, projectId, entry) {
  const kv = getKv(env);
  if (!kv) return;
  const log = await readAudit(env, projectId);
  log.unshift(entry);
  if (log.length > 500) log.length = 500;
  await kv.put(auditKey(projectId), JSON.stringify(log));
}

export async function getMcpIdentityRegistry(env, { projectId }) {
  return readRegistry(env, projectId);
}

export async function registerMcpServer(env, { projectId, name, version, vendor, description, instructions }) {
  if (!name?.trim()) return { error: "name required" };
  const registry = await readRegistry(env, projectId);
  const entry = {
    name: name.trim(),
    version: version?.trim() || "1.0.0",
    vendor: vendor?.trim() || "custom",
    description: description?.trim() || "",
    instructions: instructions?.trim() || "",
    registeredAt: new Date().toISOString(),
  };
  registry.servers = registry.servers.filter((s) => s.name !== entry.name);
  registry.servers.unshift(entry);
  await writeRegistry(env, projectId, registry);
  return { server: entry };
}

export async function registerMcpToolProvenance(env, { projectId, serverName, toolName, instructions, origin }) {
  const registry = await readRegistry(env, projectId);
  const server = registry.servers.find((s) => s.name === serverName);
  if (!server) return { error: "server_not_found" };
  const entry = {
    serverName,
    serverVersion: server.version,
    toolName: toolName.trim(),
    instructions: instructions?.trim() || server.instructions || "",
    origin: origin || "installed",
    registeredAt: new Date().toISOString(),
  };
  registry.tools = registry.tools.filter((t) => !(t.serverName === serverName && t.toolName === entry.toolName));
  registry.tools.unshift(entry);
  await writeRegistry(env, projectId, registry);
  return { tool: entry };
}

export async function listMcpToolAudit(env, { projectId, limit = 50 }) {
  const log = await readAudit(env, projectId);
  return log.slice(0, Math.min(limit, 200));
}

export async function logMcpToolCall(env, { projectId, serverName, toolName, userId, agentId, success, detail }) {
  await appendAudit(env, projectId, {
    id: `mcp_${crypto.randomUUID().slice(0, 12)}`,
    serverName: serverName || "fluxychat",
    toolName,
    userId: userId ?? null,
    agentId: agentId ?? null,
    success: success !== false,
    detail: detail ?? null,
    timestamp: new Date().toISOString(),
  });
}
