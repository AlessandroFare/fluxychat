/**
 * Curated MCP Apps marketplace — verified server catalog + per-tenant installs.
 */

import { registerMcpServer, registerMcpToolProvenance } from "./mcp-identity-store.js";
import { getLatestMarketplaceAudit } from "./marketplace-audit.js";

const CATALOG = [
  {
    id: "github-mcp",
    name: "GitHub",
    vendor: "GitHub",
    verified: true,
    auditLevel: "curated",
    description: "Search repos, read issues, and create issues from agent conversations.",
    category: "developer",
    tools: ["search_repositories", "get_issue", "create_issue"],
    serverConfig: {
      name: "github",
      version: "1.0.0",
      vendor: "GitHub",
      instructions: "Use for read-only repo lookup unless user confirms write actions.",
    },
  },
  {
    id: "slack-mcp",
    name: "Slack",
    vendor: "Slack",
    verified: true,
    auditLevel: "curated",
    description: "Post messages and list channels for support handoff workflows.",
    category: "communication",
    tools: ["post_message", "list_channels"],
    serverConfig: {
      name: "slack",
      version: "1.0.0",
      vendor: "Slack",
      instructions: "Never post to channels without explicit user approval.",
    },
  },
  {
    id: "notion-mcp",
    name: "Notion",
    vendor: "Notion",
    verified: true,
    auditLevel: "curated",
    description: "Query pages and append blocks for internal knowledge workflows.",
    category: "productivity",
    tools: ["search_pages", "append_block"],
    serverConfig: {
      name: "notion",
      version: "1.0.0",
      vendor: "Notion",
      instructions: "Respect workspace sharing boundaries.",
    },
  },
  {
    id: "linear-mcp",
    name: "Linear",
    vendor: "Linear",
    verified: true,
    auditLevel: "curated",
    description: "Create and update issues for engineering support triage.",
    category: "developer",
    tools: ["search_issues", "create_issue"],
    serverConfig: {
      name: "linear",
      version: "1.0.0",
      vendor: "Linear",
      instructions: "Default to team-scoped queries only.",
    },
  },
];

function installsKey(projectId) {
  return `mcp-apps:installed:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readInstalls(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(installsKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeInstalls(env, projectId, installs) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(installsKey(projectId), JSON.stringify(installs));
}

export async function listMcpAppsCatalog(env) {
  const base = CATALOG.map(({ serverConfig, ...rest }) => rest);
  if (!env?.DB) return base;
  return Promise.all(
    base.map(async (app) => {
      const audit = await getLatestMarketplaceAudit(env.DB, app.id);
      if (!audit) return app;
      return {
        ...app,
        auditGrade: audit.grade,
        auditScore: audit.score,
        auditScannedAt: audit.scannedAt,
        auditSeverityCritical: audit.severityCritical,
      };
    }),
  );
}

export async function getMcpAppByIdWithAudit(env, appId) {
  const app = getMcpAppById(appId);
  if (!app) return null;
  const { serverConfig, ...rest } = app;
  if (!env?.DB) return rest;
  const audit = await getLatestMarketplaceAudit(env.DB, appId);
  if (!audit) return rest;
  return {
    ...rest,
    auditGrade: audit.grade,
    auditScore: audit.score,
    auditScannedAt: audit.scannedAt,
    auditSeverityCritical: audit.severityCritical,
  };
}

export function getMcpAppById(appId) {
  return CATALOG.find((a) => a.id === appId) ?? null;
}

export async function listInstalledMcpApps(env, { projectId }) {
  return readInstalls(env, projectId);
}

export async function installMcpApp(env, { projectId, appId, agentId, installedBy }) {
  const app = getMcpAppById(appId);
  if (!app) return { error: "app_not_found" };

  await registerMcpServer(env, { projectId, ...app.serverConfig, description: app.description });

  for (const toolName of app.tools) {
    await registerMcpToolProvenance(env, {
      projectId,
      serverName: app.serverConfig.name,
      toolName,
      instructions: app.serverConfig.instructions,
      origin: "installed",
    });
  }

  const installs = await readInstalls(env, projectId);
  const now = new Date().toISOString();
  const entry = {
    appId,
    agentId: agentId || null,
    installedBy: installedBy ?? null,
    installedAt: now,
  };
  const next = installs.filter((i) => !(i.appId === appId && i.agentId === agentId));
  next.unshift(entry);
  await writeInstalls(env, projectId, next);

  return { installed: true, app: { id: app.id, name: app.name }, agentId: agentId || null };
}

export async function uninstallMcpApp(env, { projectId, appId, agentId }) {
  const installs = await readInstalls(env, projectId);
  const next = installs.filter((i) => !(i.appId === appId && (agentId ? i.agentId === agentId : true)));
  await writeInstalls(env, projectId, next);
  return { uninstalled: installs.length - next.length };
}
