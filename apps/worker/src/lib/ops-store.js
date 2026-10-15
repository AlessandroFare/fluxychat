function nowIso() {
  return new Date().toISOString();
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

function clone(value) {
  return structuredClone(value);
}

/**
 * In-memory store (tests) and the shape D1 uses. Isolation is always project_id.
 */
export function createMemoryOpsStore() {
  const tables = {
    definitions: [],
    versions: [],
    runs: [],
    steps: [],
    tasks: [],
    approvals: [],
    guests: [],
    events: [],
    budgets: [],
    tools: [],
    policies: [],
    sessions: [],
    files: [],
    views: {},
  };

  function scoped(list, projectId) {
    return list.filter((row) => row.projectId === projectId);
  }

  return {
    kind: "memory",
    tables,
    async getPolicy(projectId) {
      return tables.policies.find((row) => row.projectId === projectId)?.policy || null;
    },
    async putPolicy(projectId, policy, updatedBy) {
      const row = { projectId, policy, updatedBy, updatedAt: nowIso() };
      tables.policies = tables.policies.filter((item) => item.projectId !== projectId);
      tables.policies.push(row);
      return row;
    },
    async listTools(projectId) {
      return scoped(tables.tools, projectId);
    },
    async upsertTool(projectId, tool) {
      tables.tools = tables.tools.filter((row) => !(row.projectId === projectId && row.name === tool.name));
      const row = { ...tool, projectId };
      tables.tools.push(row);
      return row;
    },
    async createDefinition({ projectId, slug, createdBy }) {
      const existing = tables.definitions.find((row) => row.projectId === projectId && row.slug === slug);
      if (existing) return existing;
      const row = { id: id("opd"), projectId, slug, createdBy, createdAt: nowIso() };
      tables.definitions.push(row);
      return row;
    },
    async getDefinition(projectId, definitionId) {
      return scoped(tables.definitions, projectId).find((row) => row.id === definitionId) || null;
    },
    async saveVersion({ projectId, definitionId, version, status, definition, createdBy, publishedBy }) {
      const row = {
        id: id("opv"),
        projectId,
        definitionId,
        version,
        status: status || "draft",
        definition: clone(definition),
        createdBy,
        publishedBy: publishedBy || null,
        createdAt: nowIso(),
        publishedAt: status === "published" ? nowIso() : null,
      };
      tables.versions.push(row);
      return row;
    },
    async getVersion(projectId, versionId) {
      return scoped(tables.versions, projectId).find((row) => row.id === versionId) || null;
    },
    async listVersions(projectId, definitionId) {
      return scoped(tables.versions, projectId)
        .filter((row) => row.definitionId === definitionId)
        .sort((a, b) => b.version - a.version);
    },
    async nextVersionNumber(projectId, definitionId) {
      const versions = await this.listVersions(projectId, definitionId);
      return (versions[0]?.version || 0) + 1;
    },
    async publishVersion(projectId, versionId, publishedBy) {
      const row = await this.getVersion(projectId, versionId);
      if (!row) return null;
      row.status = "published";
      row.publishedBy = publishedBy;
      row.publishedAt = nowIso();
      return row;
    },
    async latestPublished(projectId, slug) {
      const def = tables.definitions.find((row) => row.projectId === projectId && row.slug === slug);
      if (!def) return null;
      return scoped(tables.versions, projectId)
        .filter((row) => row.definitionId === def.id && row.status === "published")
        .sort((a, b) => b.version - a.version)[0] || null;
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
      tables.sessions.push(row);
      return row;
    },
    async getSession(projectId, sessionId) {
      return scoped(tables.sessions, projectId).find((row) => row.id === sessionId) || null;
    },
    async patchSession(projectId, sessionId, patch) {
      const row = await this.getSession(projectId, sessionId);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: nowIso() });
      return row;
    },
    async createRun(row) {
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
        ...row,
      };
      tables.runs.push(run);
      return run;
    },
    async getRun(projectId, runId) {
      return scoped(tables.runs, projectId).find((row) => row.id === runId) || null;
    },
    async getRunByRoom(projectId, roomId) {
      return scoped(tables.runs, projectId).find((row) => row.roomId === roomId) || null;
    },
    async listRuns(projectId, filter = {}) {
      return scoped(tables.runs, projectId).filter((row) => {
        if (filter.status && row.status !== filter.status) return false;
        return true;
      });
    },
    async saveRun(run) {
      run.updatedAt = nowIso();
      return run;
    },
    async upsertStep(row) {
      const existing = tables.steps.find(
        (item) => item.projectId === row.projectId && item.runId === row.runId && item.stepId === row.stepId,
      );
      if (existing) {
        Object.assign(existing, row);
        return existing;
      }
      const saved = { id: id("ors"), ...row };
      tables.steps.push(saved);
      return saved;
    },
    async listSteps(projectId, runId) {
      return scoped(tables.steps, projectId).filter((row) => row.runId === runId);
    },
    async createTask(row) {
      const task = { id: id("otk"), status: "open", createdAt: nowIso(), ...row };
      tables.tasks.push(task);
      return task;
    },
    async listOpenTasks(projectId, { assignee } = {}) {
      return scoped(tables.tasks, projectId).filter((row) => {
        if (row.status !== "open") return false;
        if (assignee && row.assignee !== assignee && row.role !== assignee) return false;
        return true;
      });
    },
    async getTask(projectId, taskId) {
      return scoped(tables.tasks, projectId).find((row) => row.id === taskId) || null;
    },
    async saveTask(task) {
      return task;
    },
    async createApproval(row) {
      const approval = { id: id("oap"), status: "pending", decisions: [], createdAt: nowIso(), ...row };
      tables.approvals.push(approval);
      return approval;
    },
    async getApproval(projectId, approvalId) {
      return scoped(tables.approvals, projectId).find((row) => row.id === approvalId) || null;
    },
    async listPendingApprovals(projectId) {
      return scoped(tables.approvals, projectId).filter((row) => row.status === "pending");
    },
    async saveApproval(row) {
      return row;
    },
    async createGuest(row) {
      const guest = { id: id("ogt"), createdAt: nowIso(), ...row };
      tables.guests.push(guest);
      return guest;
    },
    async getGuestByTokenHash(projectId, tokenHash) {
      return scoped(tables.guests, projectId).find((row) => row.tokenHash === tokenHash) || null;
    },
    async appendEvent(row) {
      const event = { id: id("oev"), createdAt: nowIso(), ...row };
      tables.events.push(event);
      return event;
    },
    async listEvents(projectId, runId) {
      return scoped(tables.events, projectId).filter((row) => !runId || row.runId === runId);
    },
    async getBudget(projectId, runId) {
      return tables.budgets.find((row) => row.projectId === projectId && row.runId === runId) || null;
    },
    async saveBudget(row) {
      tables.budgets = tables.budgets.filter((item) => !(item.projectId === row.projectId && item.runId === row.runId));
      tables.budgets.push(row);
      return row;
    },
    async putFile(projectId, file) {
      const row = { id: id("ofil"), projectId, ...file, createdAt: nowIso() };
      tables.files.push(row);
      return row;
    },
    async getFile(projectId, fileId) {
      return tables.files.find((row) => row.projectId === projectId && row.id === fileId) || null;
    },
    async saveFile(file) {
      return file;
    },
    async deleteFile(projectId, fileId) {
      const row = await this.getFile(projectId, fileId);
      tables.files = tables.files.filter((item) => item !== row);
      return row;
    },
    async listFiles(projectId, sourceId) {
      return tables.files.filter((row) => row.projectId === projectId && (!sourceId || row.sourceId === sourceId));
    },
    setNamedViewRows(view, rows) {
      tables.views[view] = rows;
    },
    async queryNamedView(view, filters = {}, limit = 50) {
      const rows = tables.views[view] || [];
      return rows
        .filter((row) => Object.entries(filters || {}).every(([key, value]) => value == null || row[key] === value))
        .slice(0, Math.min(limit, 200));
    },
  };
}
