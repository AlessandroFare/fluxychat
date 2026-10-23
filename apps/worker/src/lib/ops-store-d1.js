import { OPS_TOOL_EVENT_TYPES } from "./ops-tool-events.js";

function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

function parseJson(text, fallback) {
  if (text == null || text === "") return fallback;
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

function eventFromRow(row, projectId) {
  return {
    id: row.id,
    projectId,
    runId: row.run_id,
    actor: row.actor,
    eventType: row.event_type,
    inputHash: row.input_hash,
    result: parseJson(row.result_json, {}),
    createdAt: row.created_at,
  };
}

function toolFromRow(row) {
  if (!row) return null;
  return {
    projectId: row.project_id,
    name: row.name,
    description: row.description,
    side: row.side,
    risk: row.risk,
    enabled: row.enabled === 1,
    requiresApproval: row.requires_approval === 1,
    dataClasses: parseJson(row.data_classes_json, []),
    inputSchema: parseJson(row.input_schema_json, {}),
  };
}

function versionFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    definitionId: row.definition_id,
    version: row.version,
    status: row.status,
    definition: parseJson(row.definition_json, {}),
    createdBy: row.created_by,
    publishedBy: row.published_by,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  };
}

function runFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id,
    versionId: row.version_id,
    roomId: row.room_id,
    status: row.status,
    trigger: parseJson(row.trigger_json, {}),
    context: parseJson(row.context_json, {}),
    cost: parseJson(row.cost_json, {}),
    killSwitch: row.kill_switch === 1,
    currentStepId: row.current_step_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function approvalFromRow(row, projectId) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: projectId || row.project_id,
    runId: row.run_id,
    stepId: row.step_id,
    payload: parseJson(row.payload_json, {}),
    payloadHash: row.payload_hash,
    required: row.required,
    decisions: parseJson(row.decisions_json, []),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mcpServerFromRow(row, projectId) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: projectId || row.project_id,
    name: row.name,
    url: row.url,
    auth: row.auth === "oauth" || row.auth === "enterprise" ? row.auth : "secret",
    secretCiphertext: row.secret_ciphertext || null,
    secretIv: row.secret_iv || null,
    oauthClientId: row.oauth_client_id || null,
    oauthClientSecretCiphertext: row.oauth_client_secret_ciphertext || null,
    oauthClientSecretIv: row.oauth_client_secret_iv || null,
    oauthAuthorizeUrl: row.oauth_authorize_url || null,
    oauthTokenUrl: row.oauth_token_url || null,
    oauthScopes: row.oauth_scopes || null,
    enterpriseIdpTokenUrl: row.enterprise_idp_token_url || null,
    enterpriseIssuer: row.enterprise_issuer || null,
    enterpriseAudience: row.enterprise_audience || null,
    enterpriseJwksUrl: row.enterprise_jwks_url || null,
    enterpriseResourceClientId: row.enterprise_resource_client_id || null,
    enterpriseResourceClientSecretCiphertext: row.enterprise_resource_client_secret_ciphertext || null,
    enterpriseResourceClientSecretIv: row.enterprise_resource_client_secret_iv || null,
    allowedTools: parseJson(row.allowed_tools_json, []),
    discoveredTools: parseJson(row.discovered_tools_json, []),
    toolsCatalog: parseJson(row.tools_catalog_json, []),
    enabled: row.enabled !== 0,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mcpConnectionFromRow(row, projectId) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: projectId || row.project_id,
    serverId: row.server_id,
    userId: row.user_id,
    accessCiphertext: row.access_ciphertext,
    accessIv: row.access_iv,
    refreshCiphertext: row.refresh_ciphertext || null,
    refreshIv: row.refresh_iv || null,
    scopes: row.scopes || null,
    tokenType: row.token_type || null,
    tokenUrl: row.token_url || null,
    clientId: row.client_id || null,
    expiresAt: row.expires_at || null,
    status: row.status || "active",
    lastRefreshFailure: row.last_refresh_failure || null,
    refreshAttempts: row.refresh_attempts || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mcpOauthStateFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    stateHash: row.state_hash,
    projectId: row.project_id,
    serverId: row.server_id,
    userId: row.user_id,
    verifierCiphertext: row.verifier_ciphertext,
    verifierIv: row.verifier_iv,
    redirectUri: row.redirect_uri,
    tokenUrl: row.token_url,
    clientId: row.client_id || null,
    mode: row.mode || "oauth",
    expireAt: row.expire_at,
    createdAt: row.created_at,
  };
}

/**
 * Durable FluxyOps store. Same method surface as createMemoryOpsStore.
 */
export function createD1OpsStore(env) {
  const db = env.DB;
  const viewCache = new Map();

  return {
    kind: "d1",
    async getPolicy(projectId) {
      const row = await db.prepare("SELECT policy_json FROM ops_policies WHERE project_id = ?").bind(projectId).first();
      return row ? parseJson(row.policy_json, null) : null;
    },
    async putPolicy(projectId, policy, updatedBy) {
      const now = nowIso();
      await db
        .prepare(
          `INSERT INTO ops_policies (project_id, policy_json, updated_by, updated_at)
           VALUES (?, ?, ?, ?)
           ON CONFLICT(project_id) DO UPDATE SET policy_json = excluded.policy_json, updated_by = excluded.updated_by, updated_at = excluded.updated_at`,
        )
        .bind(projectId, JSON.stringify(policy), updatedBy, now)
        .run();
      return { projectId, policy, updatedBy, updatedAt: now };
    },
    async listTools(projectId) {
      const { results } = await db.prepare("SELECT * FROM ops_tools WHERE project_id = ?").bind(projectId).all();
      return (results || []).map(toolFromRow);
    },
    async upsertTool(projectId, tool) {
      await db
        .prepare(
          `INSERT INTO ops_tools (project_id, name, description, side, risk, enabled, requires_approval, data_classes_json, input_schema_json)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, name) DO UPDATE SET
             description = excluded.description, side = excluded.side, risk = excluded.risk,
             enabled = excluded.enabled, requires_approval = excluded.requires_approval,
             data_classes_json = excluded.data_classes_json, input_schema_json = excluded.input_schema_json`,
        )
        .bind(
          projectId,
          tool.name,
          tool.description || "",
          tool.side || "read",
          tool.risk || "low",
          tool.enabled ? 1 : 0,
          tool.requiresApproval ? 1 : 0,
          JSON.stringify(tool.dataClasses || []),
          JSON.stringify(tool.inputSchema || {}),
        )
        .run();
      return { ...tool, projectId };
    },
    async createDefinition({ projectId, slug, createdBy }) {
      const existing = await db
        .prepare("SELECT * FROM ops_process_definitions WHERE project_id = ? AND slug = ?")
        .bind(projectId, slug)
        .first();
      if (existing) {
        return { id: existing.id, projectId, slug, createdBy: existing.created_by, createdAt: existing.created_at };
      }
      const row = { id: id("opd"), projectId, slug, createdBy, createdAt: nowIso() };
      await db
        .prepare(
          "INSERT INTO ops_process_definitions (id, project_id, slug, created_by, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(row.id, projectId, slug, createdBy, row.createdAt)
        .run();
      return row;
    },
    async getDefinition(projectId, definitionId) {
      const row = await db
        .prepare("SELECT * FROM ops_process_definitions WHERE project_id = ? AND id = ?")
        .bind(projectId, definitionId)
        .first();
      if (!row) return null;
      return { id: row.id, projectId, slug: row.slug, createdBy: row.created_by, createdAt: row.created_at };
    },
    async saveVersion({ projectId, definitionId, version, status, definition, createdBy, publishedBy }) {
      const row = {
        id: id("opv"),
        projectId,
        definitionId,
        version,
        status: status || "draft",
        definition,
        createdBy,
        publishedBy: publishedBy || null,
        createdAt: nowIso(),
        publishedAt: status === "published" ? nowIso() : null,
      };
      await db
        .prepare(
          `INSERT INTO ops_process_versions
           (id, project_id, definition_id, version, status, definition_json, created_by, published_by, created_at, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          projectId,
          definitionId,
          version,
          row.status,
          JSON.stringify(definition),
          createdBy,
          row.publishedBy,
          row.createdAt,
          row.publishedAt,
        )
        .run();
      return row;
    },
    async getVersion(projectId, versionId) {
      const row = await db
        .prepare("SELECT * FROM ops_process_versions WHERE project_id = ? AND id = ?")
        .bind(projectId, versionId)
        .first();
      return versionFromRow(row);
    },
    async listVersions(projectId, definitionId) {
      const { results } = await db
        .prepare(
          "SELECT * FROM ops_process_versions WHERE project_id = ? AND definition_id = ? ORDER BY version DESC",
        )
        .bind(projectId, definitionId)
        .all();
      return (results || []).map(versionFromRow);
    },
    async nextVersionNumber(projectId, definitionId) {
      const versions = await this.listVersions(projectId, definitionId);
      return (versions[0]?.version || 0) + 1;
    },
    async publishVersion(projectId, versionId, publishedBy) {
      const now = nowIso();
      await db
        .prepare(
          `UPDATE ops_process_versions SET status = 'published', published_by = ?, published_at = ?
           WHERE project_id = ? AND id = ?`,
        )
        .bind(publishedBy, now, projectId, versionId)
        .run();
      return this.getVersion(projectId, versionId);
    },
    async latestPublished(projectId, slug) {
      const row = await db
        .prepare(
          `SELECT v.* FROM ops_process_versions v
           INNER JOIN ops_process_definitions d ON d.id = v.definition_id AND d.project_id = v.project_id
           WHERE v.project_id = ? AND d.slug = ? AND v.status = 'published'
           ORDER BY v.version DESC LIMIT 1`,
        )
        .bind(projectId, slug)
        .first();
      return versionFromRow(row);
    },
    /** Latest published version of every definition (webhook trigger matching). */
    async listLatestPublished(projectId) {
      const { results } = await db
        .prepare(
          `SELECT v.*, d.slug AS slug FROM ops_process_versions v
           INNER JOIN ops_process_definitions d ON d.id = v.definition_id AND d.project_id = v.project_id
           WHERE v.project_id = ? AND v.status = 'published'
             AND v.version = (
               SELECT MAX(v2.version) FROM ops_process_versions v2
               WHERE v2.project_id = v.project_id AND v2.definition_id = v.definition_id
                 AND v2.status = 'published'
             )
           ORDER BY d.slug`,
        )
        .bind(projectId)
        .all();
      return (results || []).map((row) => ({ ...versionFromRow(row), slug: row.slug }));
    },
    async createSession({ projectId, roomId, createdBy }) {
      const row = {
        id: id("ops"),
        projectId,
        roomId: roomId || null,
        draftVersionId: null,
        createdBy,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      await db
        .prepare(
          `INSERT INTO ops_builder_sessions (id, project_id, room_id, draft_version_id, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(row.id, projectId, row.roomId, null, createdBy, row.createdAt, row.updatedAt)
        .run();
      return row;
    },
    async getSession(projectId, sessionId) {
      const row = await db
        .prepare("SELECT * FROM ops_builder_sessions WHERE project_id = ? AND id = ?")
        .bind(projectId, sessionId)
        .first();
      if (!row) return null;
      return {
        id: row.id,
        projectId,
        roomId: row.room_id,
        draftVersionId: row.draft_version_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },
    async patchSession(projectId, sessionId, patch) {
      const row = await this.getSession(projectId, sessionId);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: nowIso() });
      await db
        .prepare(
          `UPDATE ops_builder_sessions SET room_id = ?, draft_version_id = ?, updated_at = ?
           WHERE project_id = ? AND id = ?`,
        )
        .bind(row.roomId, row.draftVersionId, row.updatedAt, projectId, sessionId)
        .run();
      return row;
    },
    async createRun(input) {
      const run = {
        id: id("opr"),
        status: "pending",
        trigger: {},
        context: {},
        cost: { toolCalls: 0, tokens: 0 },
        killSwitch: false,
        currentStepId: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...input,
      };
      await db
        .prepare(
          `INSERT INTO ops_runs
           (id, project_id, version_id, room_id, status, trigger_json, context_json, cost_json, kill_switch, current_step_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          run.id,
          run.projectId,
          run.versionId,
          run.roomId,
          run.status,
          JSON.stringify(run.trigger || {}),
          JSON.stringify(run.context || {}),
          JSON.stringify(run.cost || {}),
          run.killSwitch ? 1 : 0,
          run.currentStepId,
          run.createdAt,
          run.updatedAt,
        )
        .run();
      return run;
    },
    async getRun(projectId, runId) {
      const row = await db.prepare("SELECT * FROM ops_runs WHERE project_id = ? AND id = ?").bind(projectId, runId).first();
      return runFromRow(row);
    },
    async getRunByRoom(projectId, roomId) {
      const row = await db
        .prepare("SELECT * FROM ops_runs WHERE project_id = ? AND room_id = ? ORDER BY created_at DESC LIMIT 1")
        .bind(projectId, roomId)
        .first();
      return runFromRow(row);
    },
    async listRuns(projectId, filter = {}) {
      let sql = "SELECT * FROM ops_runs WHERE project_id = ?";
      const binds = [projectId];
      if (filter.status) {
        sql += " AND status = ?";
        binds.push(filter.status);
      }
      sql += " ORDER BY updated_at DESC LIMIT 100";
      const { results } = await db.prepare(sql).bind(...binds).all();
      return (results || []).map(runFromRow);
    },
    async saveRun(run) {
      run.updatedAt = nowIso();
      await db
        .prepare(
          `UPDATE ops_runs SET status = ?, context_json = ?, cost_json = ?, kill_switch = ?, current_step_id = ?, updated_at = ?
           WHERE project_id = ? AND id = ?`,
        )
        .bind(
          run.status,
          JSON.stringify(run.context || {}),
          JSON.stringify(run.cost || {}),
          run.killSwitch ? 1 : 0,
          run.currentStepId,
          run.updatedAt,
          run.projectId,
          run.id,
        )
        .run();
      return run;
    },
    async upsertStep(row) {
      const existing = await db
        .prepare("SELECT id FROM ops_run_steps WHERE project_id = ? AND run_id = ? AND step_id = ?")
        .bind(row.projectId, row.runId, row.stepId)
        .first();
      const saved = { id: existing?.id || id("ors"), status: "pending", attempts: 0, ...row };
      if (existing) {
        await db
          .prepare(
            `UPDATE ops_run_steps SET status = ?, attempts = ?, result_json = ?, error = ?, interrupt_reason = ?, started_at = ?, ended_at = ?
             WHERE id = ? AND project_id = ?`,
          )
          .bind(
            saved.status,
            saved.attempts || 0,
            saved.result ? JSON.stringify(saved.result) : null,
            saved.error || null,
            saved.interruptReason || null,
            saved.startedAt || null,
            saved.endedAt || null,
            saved.id,
            row.projectId,
          )
          .run();
      } else {
        await db
          .prepare(
            `INSERT INTO ops_run_steps
             (id, project_id, run_id, step_id, status, attempts, result_json, error, interrupt_reason, started_at, ended_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            saved.id,
            row.projectId,
            row.runId,
            row.stepId,
            saved.status,
            saved.attempts || 0,
            saved.result ? JSON.stringify(saved.result) : null,
            saved.error || null,
            saved.interruptReason || null,
            saved.startedAt || null,
            saved.endedAt || null,
          )
          .run();
      }
      return saved;
    },
    async listSteps(projectId, runId) {
      const { results } = await db
        .prepare("SELECT * FROM ops_run_steps WHERE project_id = ? AND run_id = ?")
        .bind(projectId, runId)
        .all();
      return (results || []).map((row) => ({
        id: row.id,
        projectId,
        runId: row.run_id,
        stepId: row.step_id,
        status: row.status,
        attempts: row.attempts,
        result: parseJson(row.result_json, null),
        error: row.error,
        interruptReason: row.interrupt_reason,
        startedAt: row.started_at,
        endedAt: row.ended_at,
      }));
    },
    async createTask(row) {
      const task = { id: id("otk"), status: "open", createdAt: nowIso(), ...row };
      await db
        .prepare(
          `INSERT INTO ops_tasks (id, project_id, run_id, step_id, assignee, role, due_at, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          task.id,
          row.projectId,
          row.runId,
          row.stepId,
          task.assignee || null,
          task.role || null,
          task.dueAt || null,
          task.status,
          task.createdAt,
        )
        .run();
      return task;
    },
    async listOpenTasks(projectId, { assignee, roles = [] } = {}) {
      const { results } = await db
        .prepare("SELECT * FROM ops_tasks WHERE project_id = ? AND status = 'open'")
        .bind(projectId)
        .all();
      return (results || [])
        .map((row) => ({
          id: row.id,
          projectId,
          runId: row.run_id,
          stepId: row.step_id,
          assignee: row.assignee,
          role: row.role,
          dueAt: row.due_at,
          status: row.status,
          createdAt: row.created_at,
        }))
        // Same rule as the complete-task gate: assignee, or a holder of the role.
        .filter((row) => !assignee || row.assignee === assignee || row.role === assignee || (row.role && roles.includes(row.role)));
    },
    async getTask(projectId, taskId) {
      const row = await db.prepare("SELECT * FROM ops_tasks WHERE project_id = ? AND id = ?").bind(projectId, taskId).first();
      if (!row) return null;
      return {
        id: row.id,
        projectId,
        runId: row.run_id,
        stepId: row.step_id,
        assignee: row.assignee,
        role: row.role,
        dueAt: row.due_at,
        status: row.status,
        createdAt: row.created_at,
      };
    },
    async saveTask(task) {
      await db
        .prepare("UPDATE ops_tasks SET status = ?, assignee = ?, role = ?, due_at = ? WHERE project_id = ? AND id = ?")
        .bind(task.status, task.assignee || null, task.role || null, task.dueAt || null, task.projectId, task.id)
        .run();
      return task;
    },
    async createApproval(row) {
      const approval = { id: id("oap"), status: "pending", decisions: [], createdAt: nowIso(), ...row };
      await db
        .prepare(
          `INSERT INTO ops_approvals (id, project_id, run_id, step_id, payload_json, payload_hash, required, decisions_json, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          approval.id,
          row.projectId,
          row.runId,
          row.stepId,
          JSON.stringify(row.payload || {}),
          row.payloadHash,
          row.required || 1,
          JSON.stringify(approval.decisions || []),
          approval.status,
          approval.createdAt,
        )
        .run();
      return approval;
    },
    async getApproval(projectId, approvalId) {
      const row = await db
        .prepare("SELECT * FROM ops_approvals WHERE project_id = ? AND id = ?")
        .bind(projectId, approvalId)
        .first();
      return approvalFromRow(row, projectId);
    },
    async listPendingApprovals(projectId) {
      const { results } = await db
        .prepare("SELECT * FROM ops_approvals WHERE project_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 100")
        .bind(projectId)
        .all();
      return (results || []).map((row) => approvalFromRow(row, projectId)).filter(Boolean);
    },
    /** All approvals (optional status filter) — evidence packs and audit views. */
    async listApprovals(projectId, filter = {}) {
      let sql = "SELECT * FROM ops_approvals WHERE project_id = ?";
      const binds = [projectId];
      if (filter.status) {
        sql += " AND status = ?";
        binds.push(filter.status);
      }
      sql += " ORDER BY created_at DESC LIMIT 200";
      const { results } = await db.prepare(sql).bind(...binds).all();
      return (results || []).map((row) => approvalFromRow(row, projectId)).filter(Boolean);
    },
    async listMcpServers(projectId) {
      const { results } = await db
        .prepare("SELECT * FROM ops_mcp_servers WHERE project_id = ? ORDER BY name")
        .bind(projectId)
        .all();
      return (results || []).map((row) => mcpServerFromRow(row, projectId)).filter(Boolean);
    },
    async getMcpServer(projectId, serverId) {
      const row = await db
        .prepare("SELECT * FROM ops_mcp_servers WHERE project_id = ? AND id = ?")
        .bind(projectId, serverId)
        .first();
      return mcpServerFromRow(row, projectId);
    },
    async getMcpServerByName(projectId, name) {
      const row = await db
        .prepare("SELECT * FROM ops_mcp_servers WHERE project_id = ? AND name = ?")
        .bind(projectId, name)
        .first();
      return mcpServerFromRow(row, projectId);
    },
    async upsertMcpServer(projectId, server) {
      const existing = await this.getMcpServerByName(projectId, server.name);
      const now = nowIso();
      const row = {
        ...(existing || {}),
        ...server,
        id: existing?.id || server.id || id("omcp"),
        projectId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await db
        .prepare(
          `INSERT INTO ops_mcp_servers (id, project_id, name, url, auth, secret_ciphertext, secret_iv,
             oauth_client_id, oauth_client_secret_ciphertext, oauth_client_secret_iv,
             oauth_authorize_url, oauth_token_url, oauth_scopes,
             enterprise_idp_token_url, enterprise_issuer, enterprise_audience, enterprise_jwks_url,
             enterprise_resource_client_id, enterprise_resource_client_secret_ciphertext,
             enterprise_resource_client_secret_iv,
             allowed_tools_json, discovered_tools_json, tools_catalog_json, enabled, created_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, url = excluded.url,
             auth = excluded.auth,
             secret_ciphertext = excluded.secret_ciphertext, secret_iv = excluded.secret_iv,
             oauth_client_id = excluded.oauth_client_id,
             oauth_client_secret_ciphertext = excluded.oauth_client_secret_ciphertext,
             oauth_client_secret_iv = excluded.oauth_client_secret_iv,
             oauth_authorize_url = excluded.oauth_authorize_url,
             oauth_token_url = excluded.oauth_token_url,
             oauth_scopes = excluded.oauth_scopes,
             enterprise_idp_token_url = excluded.enterprise_idp_token_url,
             enterprise_issuer = excluded.enterprise_issuer,
             enterprise_audience = excluded.enterprise_audience,
             enterprise_jwks_url = excluded.enterprise_jwks_url,
             enterprise_resource_client_id = excluded.enterprise_resource_client_id,
             enterprise_resource_client_secret_ciphertext = excluded.enterprise_resource_client_secret_ciphertext,
             enterprise_resource_client_secret_iv = excluded.enterprise_resource_client_secret_iv,
             allowed_tools_json = excluded.allowed_tools_json, discovered_tools_json = excluded.discovered_tools_json,
             tools_catalog_json = excluded.tools_catalog_json,
             enabled = excluded.enabled, updated_at = excluded.updated_at`,
        )
        .bind(
          row.id,
          projectId,
          row.name,
          row.url,
          row.auth === "oauth" || row.auth === "enterprise" ? row.auth : "secret",
          row.secretCiphertext || null,
          row.secretIv || null,
          row.oauthClientId || null,
          row.oauthClientSecretCiphertext || null,
          row.oauthClientSecretIv || null,
          row.oauthAuthorizeUrl || null,
          row.oauthTokenUrl || null,
          row.oauthScopes || null,
          row.enterpriseIdpTokenUrl || null,
          row.enterpriseIssuer || null,
          row.enterpriseAudience || null,
          row.enterpriseJwksUrl || null,
          row.enterpriseResourceClientId || null,
          row.enterpriseResourceClientSecretCiphertext || null,
          row.enterpriseResourceClientSecretIv || null,
          JSON.stringify(row.allowedTools || []),
          JSON.stringify(row.discoveredTools || []),
          JSON.stringify(row.toolsCatalog || []),
          row.enabled === false ? 0 : 1,
          row.createdBy || null,
          row.createdAt,
          row.updatedAt,
        )
        .run();
      return row;
    },
    async deleteMcpServer(projectId, serverId) {
      const row = await this.getMcpServer(projectId, serverId);
      if (!row) return null;
      await db.prepare("DELETE FROM ops_mcp_servers WHERE project_id = ? AND id = ?").bind(projectId, serverId).run();
      // Connections are the removed server's tokens: they must not survive it.
      await db.prepare("DELETE FROM ops_mcp_connections WHERE project_id = ? AND server_id = ?").bind(projectId, serverId).run();
      return row;
    },
    async upsertMcpConnection(projectId, connection) {
      const existing = await this.getMcpConnection(projectId, connection.serverId, connection.userId);
      const now = nowIso();
      const row = {
        ...(existing || {}),
        ...connection,
        id: existing?.id || connection.id || id("omcn"),
        projectId,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };
      await db
        .prepare(
          `INSERT INTO ops_mcp_connections (id, project_id, server_id, user_id, access_ciphertext, access_iv,
             refresh_ciphertext, refresh_iv, scopes, token_type, token_url, client_id, expires_at, status,
             last_refresh_failure, refresh_attempts, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET access_ciphertext = excluded.access_ciphertext, access_iv = excluded.access_iv,
             refresh_ciphertext = excluded.refresh_ciphertext, refresh_iv = excluded.refresh_iv,
             scopes = excluded.scopes, token_type = excluded.token_type, token_url = excluded.token_url,
             client_id = excluded.client_id, expires_at = excluded.expires_at, status = excluded.status,
             last_refresh_failure = excluded.last_refresh_failure, refresh_attempts = excluded.refresh_attempts,
             updated_at = excluded.updated_at`,
        )
        .bind(
          row.id,
          projectId,
          row.serverId,
          row.userId,
          row.accessCiphertext,
          row.accessIv,
          row.refreshCiphertext || null,
          row.refreshIv || null,
          row.scopes || null,
          row.tokenType || null,
          row.tokenUrl || null,
          row.clientId || null,
          row.expiresAt || null,
          row.status || "active",
          row.lastRefreshFailure || null,
          Number(row.refreshAttempts) || 0,
          row.createdAt,
          row.updatedAt,
        )
        .run();
      return row;
    },
    async getMcpConnection(projectId, serverId, userId) {
      const row = await db
        .prepare("SELECT * FROM ops_mcp_connections WHERE project_id = ? AND server_id = ? AND user_id = ?")
        .bind(projectId, serverId, userId)
        .first();
      return mcpConnectionFromRow(row, projectId);
    },
    async listMcpConnections(projectId, filter = {}) {
      const { results } = await db
        .prepare("SELECT * FROM ops_mcp_connections WHERE project_id = ? AND (? IS NULL OR user_id = ?) ORDER BY updated_at DESC")
        .bind(projectId, filter.userId || null, filter.userId || null)
        .all();
      return (results || []).map((row) => mcpConnectionFromRow(row, projectId)).filter(Boolean);
    },
    async deleteMcpConnection(projectId, connectionId) {
      const row = await db
        .prepare("SELECT * FROM ops_mcp_connections WHERE project_id = ? AND id = ?")
        .bind(projectId, connectionId)
        .first();
      if (!row) return null;
      await db.prepare("DELETE FROM ops_mcp_connections WHERE project_id = ? AND id = ?").bind(projectId, connectionId).run();
      return mcpConnectionFromRow(row, projectId);
    },
    async createMcpOauthState(state) {
      const row = { id: id("omst"), createdAt: nowIso(), ...state };
      await db
        .prepare(
          `INSERT INTO ops_mcp_oauth_states (id, state_hash, project_id, server_id, user_id, verifier_ciphertext, verifier_iv,
             redirect_uri, token_url, client_id, mode, expire_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          row.stateHash,
          row.projectId,
          row.serverId,
          row.userId,
          row.verifierCiphertext,
          row.verifierIv,
          row.redirectUri,
          row.tokenUrl,
          row.clientId || null,
          row.mode || "oauth",
          row.expireAt,
          row.createdAt,
        )
        .run();
      return row;
    },
    async takeMcpOauthState(stateHash) {
      const row = await db.prepare("SELECT * FROM ops_mcp_oauth_states WHERE state_hash = ?").bind(stateHash).first();
      if (!row) return null;
      // Single-use: the delete must win the race, or the state was already consumed.
      const deleted = await db
        .prepare("DELETE FROM ops_mcp_oauth_states WHERE id = ? AND state_hash = ?")
        .bind(row.id, stateHash)
        .run();
      if (!(Number(deleted.meta?.changes || 0) > 0)) return null;
      return mcpOauthStateFromRow(row);
    },
    async purgeMcpOauthStates(before) {
      await db.prepare("DELETE FROM ops_mcp_oauth_states WHERE expire_at < ?").bind(String(before)).run();
    },
    async saveApproval(row) {
      await db
        .prepare("UPDATE ops_approvals SET decisions_json = ?, status = ? WHERE project_id = ? AND id = ?")
        .bind(JSON.stringify(row.decisions || []), row.status, row.projectId, row.id)
        .run();
      return row;
    },
    async createGuest(row) {
      const guest = { id: id("ogt"), createdAt: nowIso(), ...row };
      await db
        .prepare(
          `INSERT INTO ops_guests (id, project_id, run_id, email, scope_json, token_hash, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          guest.id,
          row.projectId,
          row.runId,
          row.email,
          JSON.stringify(row.scope || []),
          row.tokenHash,
          row.expiresAt,
          guest.createdAt,
        )
        .run();
      return guest;
    },
    async getGuestByTokenHash(projectId, tokenHash) {
      const row = await db
        .prepare("SELECT * FROM ops_guests WHERE project_id = ? AND token_hash = ?")
        .bind(projectId, tokenHash)
        .first();
      if (!row) return null;
      return {
        id: row.id,
        projectId,
        runId: row.run_id,
        email: row.email,
        scope: parseJson(row.scope_json, []),
        tokenHash: row.token_hash,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        redeemedAt: row.redeemed_at || null,
      };
    },
    async markGuestRedeemed(projectId, guestId) {
      // Audit F-88: single-use claim — only the first redemption reports a change.
      const result = await db
        .prepare("UPDATE ops_guests SET redeemed_at = ? WHERE id = ? AND project_id = ? AND redeemed_at IS NULL")
        .bind(nowIso(), guestId, projectId)
        .run();
      return Number(result.meta?.changes || 0) > 0;
    },
    async appendEvent(row) {
      const event = { id: id("oev"), createdAt: nowIso(), ...row };
      await db
        .prepare(
          `INSERT INTO ops_events (id, project_id, run_id, actor, event_type, input_hash, result_json, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          event.id,
          row.projectId,
          row.runId || null,
          row.actor || null,
          row.eventType,
          row.inputHash || null,
          JSON.stringify(row.result || {}),
          event.createdAt,
        )
        .run();
      return event;
    },
    async listEvents(projectId, runId) {
      const { results } = await db
        .prepare("SELECT * FROM ops_events WHERE project_id = ? AND (? IS NULL OR run_id = ?) ORDER BY created_at ASC")
        .bind(projectId, runId || null, runId || null)
        .all();
      return (results || []).map((row) => eventFromRow(row, projectId));
    },
    async listEventsSince(projectId, { since = null, until = null, limit = 5000 } = {}) {
      const capped = Math.max(1, Math.min(Number(limit) || 5000, 20000));
      const { results } = await db
        .prepare(
          `SELECT * FROM ops_events WHERE project_id = ?
             AND (? IS NULL OR created_at >= ?) AND (? IS NULL OR created_at <= ?)
           ORDER BY created_at ASC LIMIT ?`,
        )
        .bind(projectId, since, since, until, until, capped)
        .all();
      return (results || []).map((row) => eventFromRow(row, projectId));
    },
    async listToolEvents(projectId, { limit = 100, runId = null } = {}) {
      const capped = Math.max(1, Math.min(Number(limit) || 100, 200));
      const placeholders = OPS_TOOL_EVENT_TYPES.map(() => "?").join(", ");
      const { results } = await db
        .prepare(
          `SELECT * FROM ops_events WHERE project_id = ? AND event_type IN (${placeholders})
             AND (? IS NULL OR run_id = ?)
           ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(projectId, ...OPS_TOOL_EVENT_TYPES, runId || null, runId || null, capped)
        .all();
      return (results || []).map((row) => eventFromRow(row, projectId));
    },
    async countToolCallsSince(projectId, { tool, since = null } = {}) {
      const row = await db
        .prepare(
          `SELECT COUNT(*) AS n FROM ops_events
            WHERE project_id = ?
              AND event_type IN ('ops.tool.called', 'ops.tool.failed')
              AND json_extract(result_json, '$.tool') = ?
              AND (? IS NULL OR created_at >= ?)`,
        )
        .bind(projectId, tool, since, since)
        .first();
      return Number(row?.n) || 0;
    },
    async getBudget(projectId, runId) {
      const row = await db
        .prepare("SELECT * FROM ops_budgets WHERE project_id = ? AND run_id = ?")
        .bind(projectId, runId)
        .first();
      if (!row) return null;
      return {
        projectId,
        runId,
        maxToolCalls: row.max_tool_calls,
        maxTokens: row.max_tokens,
        toolCalls: row.tool_calls,
        tokens: row.tokens,
      };
    },
    async saveBudget(row) {
      await db
        .prepare(
          `INSERT INTO ops_budgets (project_id, run_id, max_tool_calls, max_tokens, tool_calls, tokens)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(project_id, run_id) DO UPDATE SET
             max_tool_calls = excluded.max_tool_calls, max_tokens = excluded.max_tokens,
             tool_calls = excluded.tool_calls, tokens = excluded.tokens`,
        )
        .bind(row.projectId, row.runId, row.maxToolCalls || null, row.maxTokens || null, row.toolCalls || 0, row.tokens || 0)
        .run();
      return row;
    },
    async putFile(projectId, file) {
      const row = { id: id("ofil"), projectId, ...file, createdAt: nowIso() };
      await db
        .prepare(
          `INSERT INTO ops_files (id, project_id, source_id, key, content_type, text, item_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          row.id,
          projectId,
          row.sourceId || "files",
          row.key,
          row.contentType || null,
          row.text || null,
          row.itemId || null,
          row.createdAt,
        )
        .run();
      return row;
    },
    async saveFile(file) {
      await db
        .prepare("UPDATE ops_files SET item_id = ?, text = ? WHERE project_id = ? AND id = ?")
        .bind(file.itemId || null, file.text || null, file.projectId, file.id)
        .run();
      return file;
    },
    async getFile(projectId, fileId) {
      const row = await db.prepare("SELECT * FROM ops_files WHERE project_id = ? AND id = ?").bind(projectId, fileId).first();
      if (!row) return null;
      return {
        id: row.id,
        projectId,
        sourceId: row.source_id,
        key: row.key,
        contentType: row.content_type,
        text: row.text,
        itemId: row.item_id,
        createdAt: row.created_at,
      };
    },
    async deleteFile(projectId, fileId) {
      const row = await this.getFile(projectId, fileId);
      if (row) {
        await db.prepare("DELETE FROM ops_files WHERE project_id = ? AND id = ?").bind(projectId, fileId).run();
      }
      return row;
    },
    async listFiles(projectId, sourceId) {
      const { results } = await db.prepare("SELECT * FROM ops_files WHERE project_id = ?").bind(projectId).all();
      return (results || [])
        .map((row) => ({
          id: row.id,
          projectId,
          sourceId: row.source_id,
          key: row.key,
          contentType: row.content_type,
          text: row.text,
          itemId: row.item_id,
          createdAt: row.created_at,
        }))
        .filter((row) => !sourceId || row.sourceId === sourceId);
    },
    setNamedViewRows(view, rows) {
      viewCache.set(view, rows);
    },
    async queryNamedView(view, filters = {}, limit = 50) {
      const rows = viewCache.get(view) || [];
      return rows
        .filter((row) => Object.entries(filters || {}).every(([key, value]) => value == null || row[key] === value))
        .slice(0, Math.min(limit, 200));
    },
  };
}
