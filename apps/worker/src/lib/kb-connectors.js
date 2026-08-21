/**
 * KB connectors — URL/text ingest + source registry (KV) with D1 article storage.
 */

import { createKBArticle, listKBArticles, updateKBArticle } from "./enterprise-support.js";
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
  return rows.slice(0, Math.min(limit, 50)).map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: (row.content || "").slice(0, 280),
    category: row.category,
    tags: row.tags,
    updatedAt: row.updatedAt,
  }));
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
