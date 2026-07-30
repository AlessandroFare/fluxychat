import { provisionBuiltinAgents } from "./provision-builtin-agents.js";

function normalizeHandle(handle) {
  const trimmed = String(handle || "").trim();
  if (!trimmed) return "";
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

/**
 * Ensure demo project bots exist and resolve the playground agent row.
 */
export async function resolveDemoAgent(env, projectId) {
  await provisionBuiltinAgents(env, projectId);

  const explicitId = String(env.DEMO_AGENT_ID || "").trim();
  if (explicitId) {
    const row = await env.DB.prepare(
      "SELECT id, name, handle FROM bots WHERE id = ? AND project_id = ? LIMIT 1",
    )
      .bind(explicitId, projectId)
      .first();
    if (row) return row;
  }

  const configuredHandle = normalizeHandle(env.DEMO_AGENT_HANDLE || "@assistant");
  const bareHandle = configuredHandle.replace(/^@/, "");
  const byHandle = await env.DB.prepare(
    "SELECT id, name, handle FROM bots WHERE project_id = ? AND (handle = ? OR handle = ? OR handle = ?) ORDER BY created_at ASC LIMIT 1",
  )
    .bind(projectId, configuredHandle, bareHandle, `@${bareHandle}`)
    .first();
  if (byHandle) return byHandle;

  return env.DB.prepare(
    "SELECT id, name, handle FROM bots WHERE project_id = ? ORDER BY created_at ASC LIMIT 1",
  )
    .bind(projectId)
    .first();
}
