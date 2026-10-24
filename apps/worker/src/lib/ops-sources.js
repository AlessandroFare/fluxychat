import { queryVectorizeRoomMemory } from "./vectorize-retriever.js";
import { catalogNamedViews, namedViewByName, OPS_NAMED_VIEWS } from "./ops-policy.js";
import { normalizeSearchHits, toCitation } from "./ops-search-hits.js";
import { createInAppNotification } from "./in-app-notifications.js";
import { callMcpTool } from "./ops-mcp.js";
import { getIncident, getIncidentTimeline } from "./incident-response.js";

export function opsR2(env) {
  return env?.OPS_R2 || env?.ATTACHMENTS || null;
}

/** OPS-06: object keys must not traverse out of `${projectId}/${fileId}/`. */
function safeOpsKey(key) {
  const base = String(key || "upload").split(/[\\/]/).pop() || "upload";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 200) || "upload";
}

async function resolveAiSearch(env, projectId) {
  const ns = env?.AI_SEARCH || env?.AI_SEARCH_DEFAULT;
  if (ns && typeof ns.get === "function") {
    let handle = ns.get(projectId) || ns.get("default");
    if (!handle && typeof ns.create === "function") {
      await ns.create({ id: projectId }).catch(() => null);
      handle = ns.get(projectId);
    }
    if (handle) return handle;
    if (typeof ns.search === "function" || ns.items) return ns;
  }
  const instance = env?.OPS_AI_SEARCH;
  if (instance && (typeof instance.search === "function" || instance.items)) return instance;
  if (typeof env?.AI?.autorag === "function") {
    return env.AI.autorag(String(env.OPS_AI_SEARCH_INSTANCE || projectId || "fluxychat-ops"));
  }
  return ns && (typeof ns.search === "function" || ns.items) ? ns : null;
}

async function indexOpsItem(search, { id, filename, metadata, content }) {
  if (search?.items?.upload) {
    return search.items.upload({ id, filename, metadata, content });
  }
  if (search?.items?.create) {
    return search.items.create({ id, filename, metadata, content });
  }
  return null;
}

async function searchAiIndex(search, { projectId, query, dataClass, sourceId }) {
  const filters = { workspace: { $eq: projectId } };
  if (dataClass) filters.dataClass = { $eq: dataClass };
  if (sourceId) filters.source = { $eq: sourceId };
  const retrieval = {
    filters,
    max_num_results: 8,
    retrieval_type: "hybrid",
    match_threshold: 0.4,
  };
  if (typeof search.search !== "function") return null;
  const modern = await search
    .search({
      query,
      messages: [{ role: "user", content: query }],
      ai_search_options: {
        retrieval,
        reranking: { enabled: true },
        query_rewrite: { enabled: true },
      },
    })
    .catch(() => null);
  if (modern) return modern;
  return search.search({ query, filter: { workspace: projectId, dataClass, source: sourceId } }).catch(() => null);
}

export async function extractOpsOcr(env, { key, contentType, text, bytes }) {
  if (String(text || "").trim()) return { text: String(text), backend: "stored" };
  if (typeof env?.AI?.toMarkdown === "function" && bytes) {
    const blob = typeof Blob === "function" ? new Blob([bytes], { type: contentType || "application/octet-stream" }) : bytes;
    const out = await env.AI.toMarkdown([{ name: key || "upload.bin", blob }]).catch(() => null);
    const md = Array.isArray(out)
      ? out.map((row) => row?.data || row?.markdown || row?.text || "").join("\n")
      : String(out?.data || out?.markdown || "");
    if (md.trim()) return { text: md, backend: "workers_ai_tomarkdown" };
  }
  return { text: String(text || ""), backend: "none" };
}

export function describeOpsSources(env, policy) {
  const ns = env?.AI_SEARCH || env?.AI_SEARCH_DEFAULT || env?.OPS_AI_SEARCH;
  return {
    aiSearch: Boolean(ns?.search || ns?.get || ns?.items || env?.AI?.autorag),
    vectorize: Boolean(env?.VECTORIZE?.query),
    r2: Boolean(opsR2(env)?.put),
    workersAi: Boolean(env?.AI?.run || env?.AI?.toMarkdown),
    namedViews: catalogNamedViews(policy),
  };
}

/**
 * Files go to R2 (OPS_R2 or ATTACHMENTS); index AI Search when bound.
 */
export async function ingestOpsFile(env, store, { projectId, sourceId, key, bytes, contentType, text }) {
  const objectKey = safeOpsKey(key);
  const file = await store.putFile(projectId, {
    sourceId: sourceId || "files",
    key: objectKey,
    contentType: contentType || "application/octet-stream",
    text: text || "",
    itemId: null,
  });
  const bucket = opsR2(env);
  if (bucket?.put) {
    await bucket.put(`${projectId}/${file.id}/${objectKey}`, bytes || text || "");
  }
  const search = await resolveAiSearch(env, projectId);
  const uploaded = await indexOpsItem(search, {
    id: file.id,
    filename: objectKey,
    metadata: { workspace: projectId, source: sourceId || "files" },
    content: bytes || text,
  });
  if (uploaded?.id || uploaded) {
    file.itemId = uploaded?.id || file.id;
    if (typeof store.saveFile === "function") await store.saveFile(file);
  }
  return file;
}

export async function deleteOpsFile(env, store, { projectId, fileId }) {
  const file = await store.deleteFile(projectId, fileId);
  if (!file) return { ok: false, error: "not_found" };
  const bucket = opsR2(env);
  if (bucket?.delete) await bucket.delete(`${projectId}/${file.id}/${safeOpsKey(file.key)}`);
  const search = await resolveAiSearch(env, projectId);
  const id = file.itemId || file.id;
  let indexDeleted = false;
  if (search?.items?.delete && id) {
    await search.items.delete(id);
    indexDeleted = true;
  }
  return { ok: true, file, indexDeleted };
}

export async function searchOpsFiles(env, store, { projectId, query, roomId, dataClass, sourceId }) {
  const search = await resolveAiSearch(env, projectId);
  if (search?.search) {
    const raw = await searchAiIndex(search, { projectId, query, dataClass, sourceId });
    if (raw) {
      const packed = normalizeSearchHits(raw, { backend: "ai_search" });
      if (packed.chunks.length) return packed;
    }
  }

  const vectorHits = await queryVectorizeRoomMemory(env, {
    projectId,
    roomId: roomId || "ops",
    query,
    topK: 8,
  }).catch(() => []);
  if (vectorHits?.length) {
    const files = await store.listFiles(projectId, sourceId);
    const byId = new Map(files.map((file) => [file.id, file]));
    return normalizeSearchHits(
      vectorHits.map((hit) => {
        const file = byId.get(hit.entryId);
        return {
          id: hit.entryId,
          content: file?.text || "",
          score: hit.score,
          source: file?.key || "vectorize",
          metadata: { projectId },
        };
      }),
      { backend: "vectorize" },
    );
  }

  const files = await store.listFiles(projectId, sourceId);
  const q = String(query || "").toLowerCase();
  return normalizeSearchHits(
    files
      .filter((file) => String(file.text || file.key || "").toLowerCase().includes(q))
      .slice(0, 8)
      .map((file) => ({
        id: file.id,
        content: file.text || "",
        score: 1,
        source: file.key,
        metadata: { projectId },
      })),
    { backend: "d1_scan" },
  );
}

export async function queryNamedView(store, policy, { view, filters, limit }) {
  const allowed = policy?.allowedViews || OPS_NAMED_VIEWS.map((item) => item.name);
  if (!view || !allowed.includes(view)) {
    // Wren-style: name what is allowed so the caller can retry without guessing.
    return { ok: false, error: "view_not_allowed", allowedViews: allowed, query: null, rows: [] };
  }
  const mdl = namedViewByName(view);
  const rawFilters = filters && typeof filters === "object" ? filters : {};
  const allowedCols = new Set(mdl?.columns || []);
  const unknown = Object.keys(rawFilters).filter((key) => rawFilters[key] != null && allowedCols.size && !allowedCols.has(key));
  if (unknown.length) {
    return {
      ok: false,
      error: "view_filter_unknown_column",
      columns: unknown,
      allowedColumns: mdl?.columns || [],
      mdl,
    };
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(rawFilters)) {
    if (value == null) continue;
    if (allowedCols.size && !allowedCols.has(key)) continue;
    sanitized[key] = value;
  }
  const rows = await store.queryNamedView(view, sanitized, limit || 50);
  return {
    ok: true,
    view,
    mdl,
    filters: sanitized,
    query: null,
    rows,
    rowCount: rows.length,
  };
}

/**
 * incidents.read: the tracked incident plus its recent timeline. With no
 * incidentId it follows the incident carried in the run that started it, so an
 * incident workflow reads its own context with no template placeholders.
 */
async function readOpsIncident(store, env, { projectId, runId, incidentId, limit }) {
  if (!env?.DB) return { ok: false, error: "db_unavailable" };
  const run = runId ? await store.getRun(projectId, runId).catch(() => null) : null;
  const fromContext = run?.context?.incident || null;
  const id = String(incidentId || fromContext?.id || "").trim();
  if (!id) return { ok: false, error: "incident_id_required" };
  const incident = await getIncident(env, { projectId, incidentId: id });
  if (!incident) return { ok: false, error: "incident_not_found" };
  const timeline = await getIncidentTimeline(env, { projectId, incidentId: id }).catch(() => []);
  const max = Math.min(Math.max(Math.trunc(Number(limit) || 20), 1), 50);
  const recent = timeline.slice(-max);
  // Keep the trigger's own fields (e.g. phase) and layer the live row on top.
  const merged = { ...(fromContext || {}), ...incident };
  const text = [
    `${incident.id} ${incident.severity || "sev?"} ${incident.status}: ${incident.title}`,
    incident.service ? `service ${incident.service}${incident.environment ? ` (${incident.environment})` : ""}` : "",
    incident.mttrSeconds ? `MTTR ${incident.mttrSeconds}s` : "",
    ...recent.map((row) => `- [${row.updateType}] ${String(row.content || "").slice(0, 300)}`),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    ok: true,
    incidentId: incident.id,
    updates: recent.length,
    data: { incident: merged, timeline: recent },
    text,
  };
}

/**
 * notify.send: persist in-app notifications for an explicit user, or every
 * member of the room the run belongs to. Best-effort by design: the step
 * result records what happened; a notify miss does not fail the run.
 */
async function notifyOpsRecipients(env, { projectId, roomId, userId, role, message, incident }) {
  if (!env?.DB || !projectId) return { ok: false, error: "db_unavailable" };
  const recipients = new Set();
  if (userId) {
    recipients.add(String(userId));
  } else if (roomId) {
    const { results } = await env.DB.prepare(
      "SELECT user_id FROM room_members WHERE project_id = ? AND room_id = ?",
    )
      .bind(projectId, roomId)
      .all()
      .catch(() => ({ results: [] }));
    for (const row of results || []) {
      if (row?.user_id) recipients.add(String(row.user_id));
    }
  }
  const title = incident?.title
    ? `Incident: ${String(incident.title).slice(0, 120)}`
    : "Ops notification";
  const body = String(message || "").slice(0, 500) || null;
  let notified = 0;
  for (const recipient of recipients) {
    try {
      await createInAppNotification(env, {
        projectId,
        userId: recipient,
        kind: "ops_notify",
        title,
        body,
        roomId: roomId || null,
      });
      notified += 1;
    } catch {
      /* skip this recipient */
    }
  }
  return { ok: true, notified, recipients: recipients.size, role: role || null };
}

export async function executeOpsTool(store, policy, env, toolName, input, extras = {}) {
  if (toolName === "files.search") {
    const packed = await searchOpsFiles(env, store, {
      projectId: extras.projectId,
      query: input.query,
      dataClass: input.dataClass,
      sourceId: input.sourceId,
    });
    return { ok: true, ...packed, data: packed };
  }
  if (toolName === "files.read") {
    const file = await store.getFile(extras.projectId, input.fileId);
    if (!file) return { ok: false, error: "not_found" };
    const citation = toCitation({ id: file.id, source: file.key, score: 1 });
    return { ok: true, data: { text: file.text, key: file.key }, citations: citation ? [citation] : [] };
  }
  if (toolName === "ocr.read") {
    const file = await store.getFile(extras.projectId, input.fileId);
    const extracted = await extractOpsOcr(env, {
      key: file?.key,
      contentType: file?.contentType,
      text: file?.text,
      bytes: input.bytes,
    });
    return {
      ok: true,
      data: { documentText: extracted.text, untrustedText: extracted.text, ocrBackend: extracted.backend },
    };
  }
  if (toolName === "db.query_named_view" || toolName === "db.query_orders") {
    const view = input.view || (toolName === "db.query_orders" ? "orders" : null);
    return queryNamedView(store, policy, { view, filters: input.filters || { invoiceNumber: input.invoiceNumber }, limit: 50 });
  }
  if (toolName === "incidents.read") {
    return readOpsIncident(store, env, {
      projectId: extras.projectId,
      runId: extras.runId,
      incidentId: input.incidentId,
      limit: input.limit,
    });
  }
  if (toolName === "notify.send") {
    return notifyOpsRecipients(env, {
      projectId: extras.projectId,
      roomId: extras.roomId,
      userId: input.userId,
      role: input.role,
      message: input.message,
      incident: input.incident,
    });
  }
  if (toolName === "mcp.call") {
    // The policy can gate the whole source: dropping "mcp" from allowedSources
    // disables every MCP call without touching the registry.
    if (!(policy?.allowedSources || []).includes("mcp")) return { ok: false, error: "source_not_allowed" };
    // The actor decides which per-user OAuth connection the call may use.
    return callMcpTool(store, env, extras.projectId, input, { actor: extras.actor });
  }
  if (toolName === "erp.register_payment") {
    return { ok: true, written: true, tool: toolName, input, idempotent: true };
  }
  return { ok: false, error: "unknown_tool" };
}
