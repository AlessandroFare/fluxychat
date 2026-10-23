/**
 * KB connectors — URL/text ingest + source registry (KV) with D1 article storage.
 */

import { createKBArticle, listKBArticles, updateKBArticle } from "./enterprise-support.js";
import { applyDocFeedback } from "./ops-search-hits.js";
import { safeOutboundFetch } from "./url-ssrf.js";

const SOURCE_TYPES = new Set(["url", "notion", "confluence", "google_drive", "intercom", "zendesk", "file"]);

function sourcesKey(projectId) {
  return `kb:sources:${projectId}`;
}

function getKv(env) {
  return env.RATE_LIMIT_KV ?? env.STREAM_RESUME_KV ?? null;
}

async function readSources(env, projectId) {
  const kv = getKv(env);
  if (!kv) return [];
  const raw = await kv.get(sourcesKey(projectId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeSources(env, projectId, sources) {
  const kv = getKv(env);
  if (!kv) throw new Error("kv_unavailable");
  await kv.put(sourcesKey(projectId), JSON.stringify(sources));
}

function articleCategory(sourceId) {
  return `kb_source:${sourceId}`;
}

function stripHtml(html) {
  let out = String(html);
  for (const tag of ["script", "style"]) {
    const open = `<${tag}`;
    const close = `</${tag}>`;
    let lower = out.toLowerCase();
    let idx = lower.indexOf(open);
    while (idx !== -1) {
      const endTag = lower.indexOf(close, idx);
      if (endTag === -1) break;
      out = `${out.slice(0, idx)} ${out.slice(endTag + close.length)}`;
      lower = out.toLowerCase();
      idx = lower.indexOf(open);
    }
  }
  let start = out.indexOf("<");
  while (start !== -1) {
    const end = out.indexOf(">", start);
    if (end === -1) break;
    out = `${out.slice(0, start)} ${out.slice(end + 1)}`;
    start = out.indexOf("<");
  }
  return out.replace(/\s+/g, " ").trim();
}

export async function listKbSources(env, { projectId }) {
  return readSources(env, projectId);
}

/**
 * Probe a URL source at creation time: a broken address should be visible in
 * the settings form, not at the first ingest. Best-effort, never blocks the save.
 */
export async function verifyKbSource(env, url) {
  const checkedAt = new Date().toISOString();
  try {
    const response = await safeOutboundFetch(
      String(url),
      {
        headers: { "User-Agent": "FluxyChat-KB-Connector/1.0" },
        signal: AbortSignal.timeout(10000),
      },
      env,
    );
    return { checkedAt, ok: response.ok, status: response.status };
  } catch (err) {
    return { checkedAt, ok: false, error: String(err?.message || err).slice(0, 160) };
  }
}

export async function createKbSource(env, { projectId, type, name, config }) {
  if (!SOURCE_TYPES.has(type)) {
    return { error: "invalid_type", message: `type must be one of: ${[...SOURCE_TYPES].join(", ")}` };
  }
  if (!name?.trim()) return { error: "name_required" };

  const sources = await readSources(env, projectId);
  const source = {
    id: `kbs_${crypto.randomUUID().slice(0, 12)}`,
    type,
    name: name.trim(),
    config: config ?? {},
    enabled: true,
    createdAt: new Date().toISOString(),
    lastSyncedAt: null,
  };
  if (type === "url" && config?.url) {
    source.verification = await verifyKbSource(env, config.url);
  }
  sources.unshift(source);
  await writeSources(env, projectId, sources);
  return { source };
}

export async function deleteKbSource(env, { projectId, sourceId }) {
  const sources = await readSources(env, projectId);
  const next = sources.filter((s) => s.id !== sourceId);
  if (next.length === sources.length) return { ok: false, error: "not_found" };
  await writeSources(env, projectId, next);
  return { ok: true };
}

const FEEDBACK_VERDICTS = new Set(["boost", "hide"]);

/** Record (or clear) per-document boost/hide feedback for knowledge search. */
export async function setKbDocFeedback(env, { projectId, docId, verdict, actor }) {
  const id = String(docId || "").trim();
  if (!id) return { error: "docId_required" };
  if (verdict === "clear") {
    await env.DB.prepare("DELETE FROM kb_doc_feedback WHERE project_id = ? AND doc_id = ?")
      .bind(projectId, id)
      .run();
    return { ok: true, cleared: true };
  }
  if (!FEEDBACK_VERDICTS.has(verdict)) {
    return { error: "invalid_verdict", message: "verdict must be one of: boost, hide, clear" };
  }
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO kb_doc_feedback (project_id, doc_id, verdict, actor, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, doc_id) DO UPDATE SET verdict = excluded.verdict, actor = excluded.actor, updated_at = excluded.updated_at`,
  )
    .bind(projectId, id, verdict, actor ?? null, now, now)
    .run();
  return { ok: true };
}

export async function listKbDocFeedback(env, { projectId }) {
  try {
    const rows = await env.DB.prepare(
      "SELECT doc_id, verdict, actor, updated_at FROM kb_doc_feedback WHERE project_id = ?",
    )
      .bind(projectId)
      .all();
    return (rows.results || []).map((row) => ({
      docId: row.doc_id,
      verdict: row.verdict,
      actor: row.actor,
      updatedAt: row.updated_at,
    }));
  } catch {
    // shortcut: pre-0261 the table is missing — search runs unfiltered, never fails.
    return [];
  }
}

export async function ingestKbDocument(env, { projectId, sourceId, title, content, url, author }) {
  const sources = await readSources(env, projectId);
  const source = sources.find((s) => s.id === sourceId);
  if (!source) return { error: "source_not_found" };
  if (!content?.trim()) return { error: "content_required" };

  const article = await createKBArticle(env, {
    projectId,
    title: title?.trim() || `${source.name} document`,
    content: content.trim(),
    category: articleCategory(sourceId),
    tags: { sourceId, type: source.type, url: url ?? null },
    author,
  });
  await updateKBArticle(env, {
    articleId: article.id,
    projectId,
    status: "published",
  });

  source.lastSyncedAt = new Date().toISOString();
  await writeSources(env, projectId, sources);

  return { articleId: article.id, sourceId, title: title?.trim() || `${source.name} document` };
}

export async function ingestKbFromUrl(env, { projectId, sourceId, url, author }) {
  if (!url?.trim()) return { error: "url_required" };
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch {
    return { error: "invalid_url" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { error: "invalid_url", message: "Only http and https URLs are supported" };
  }

  let res;
  try {
    res = await safeOutboundFetch(
      parsed.href,
      {
        headers: { "User-Agent": "FluxyChat-KB-Connector/1.0" },
        signal: AbortSignal.timeout(15000),
      },
      env,
    );
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg.includes("ssrf")) return { error: "ssrf_blocked" };
    return { error: "fetch_failed", message: msg };
  }
  if (!res.ok) return { error: "fetch_failed", status: res.status };

  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();
  const text = contentType.includes("html") ? stripHtml(raw) : raw.trim();
  if (!text) return { error: "empty_content" };

  return ingestKbDocument(env, {
    projectId,
    sourceId,
    title: parsed.hostname + parsed.pathname,
    content: text.slice(0, 200_000),
    url: parsed.href,
    author,
  });
}

export async function searchKbDocuments(env, { projectId, query, sourceId, limit = 10 }) {
  const category = sourceId ? articleCategory(sourceId) : undefined;
  const rows = await listKBArticles(env, {
    projectId,
    category,
    status: "published",
    search: query?.trim() || undefined,
  });
  const hits = rows.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: (row.content || "").slice(0, 280),
    category: row.category,
    tags: row.tags,
    updatedAt: row.updatedAt,
  }));
  const feedback = new Map(
    (await listKbDocFeedback(env, { projectId })).map((row) => [row.docId, row.verdict]),
  );
  return applyDocFeedback(hits, feedback).slice(0, Math.min(limit, 50));
}

export function buildRagContextFromHits(hits, userMessage) {
  const context = hits.map((h) => `[${h.title}]\n${h.excerpt}`).join("\n\n");
  return {
    hits,
    synthesizedPrompt: context
      ? `Context:\n${context}\n\nQuestion: ${userMessage}`
      : userMessage,
  };
}
