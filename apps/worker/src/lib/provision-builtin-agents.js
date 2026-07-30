/**
 * Seed built-in agent bots for a project from builtin_agent_templates.
 */
export async function provisionBuiltinAgents(env, projectId) {
  if (!env?.DB || !projectId) return;
  const templates = await env.DB.prepare(
    "SELECT id, name, handle, provider, model, system_prompt, capabilities, tools_schema FROM builtin_agent_templates WHERE is_active = 1",
  ).all();

  const now = new Date().toISOString();
  const stmts = (templates.results || []).map((t) =>
    env.DB.prepare(
      "INSERT OR IGNORE INTO bots (id, project_id, name, handle, provider, model, system_prompt, capabilities, config, webhook_url, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).bind(
      `${t.id}-${projectId}`,
      projectId,
      t.name,
      t.handle,
      t.provider,
      t.model,
      t.system_prompt,
      t.capabilities,
      null,
      null,
      null,
      null,
      t.tools_schema,
      30,
      now,
    ),
  );
  if (stmts.length) await env.DB.batch(stmts);

  const syncStmts = (templates.results || []).map((t) =>
    env.DB.prepare(
      "UPDATE bots SET provider = ?, model = ? WHERE project_id = ? AND id = ?",
    ).bind(t.provider, t.model, projectId, `${t.id}-${projectId}`),
  );
  if (syncStmts.length) await env.DB.batch(syncStmts);
}
