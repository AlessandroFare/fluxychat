import { resolveAdminContext } from "../lib/admin-route-context.js";
import {
  listKbSources,
  createKbSource,
  deleteKbSource,
  ingestKbDocument,
  ingestKbFromUrl,
  searchKbDocuments,
  buildRagContextFromHits,
} from "../lib/kb-connectors.js";

export async function dispatchKbConnectorRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/admin/kb")) return null;

  const ctx = await resolveAdminContext(request, h);
  if (ctx.response) return ctx.response;
  const { env, json: respond, projectId, userId } = ctx;

  if (request.method === "GET" && path === "/admin/kb/sources") {
    const sources = await listKbSources(env, { projectId });
    return respond({ sources }, h);
  }

  if (request.method === "POST" && path === "/admin/kb/sources") {
    const body = await request.json().catch(() => null);
    const result = await createKbSource(env, {
      projectId,
      type: body?.type,
      name: body?.name,
      config: body?.config,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  const sourceMatch = path.match(/^\/admin\/kb\/sources\/([^/]+)$/);
  if (sourceMatch && request.method === "DELETE") {
    const sourceId = decodeURIComponent(sourceMatch[1]);
    const result = await deleteKbSource(env, { projectId, sourceId });
    if (!result.ok) return respond({ error: result.error }, h, 404);
    return respond({ ok: true }, h);
  }

  const syncMatch = path.match(/^\/admin\/kb\/sources\/([^/]+)\/sync$/);
  if (syncMatch && request.method === "POST") {
    const sourceId = decodeURIComponent(syncMatch[1]);
    const body = await request.json().catch(() => ({}));
    const sources = await listKbSources(env, { projectId });
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return respond({ error: "source_not_found" }, h, 404);

    if (source.type === "url" && (body.url || source.config?.url)) {
      const result = await ingestKbFromUrl(env, {
        projectId,
        sourceId,
        url: body.url || source.config.url,
        author: userId,
      });
      if (result.error) return respond(result, h, 400);
      return respond(result, h);
    }

    if (body.content) {
      const result = await ingestKbDocument(env, {
        projectId,
        sourceId,
        title: body.title,
        content: body.content,
        url: body.url,
        author: userId,
      });
      if (result.error) return respond(result, h, 400);
      return respond(result, h);
    }

    return respond(
      {
        error: "sync_requires_content",
        message: "Provide content in body, or for url sources set config.url and sync without body.",
      },
      h,
      400,
    );
  }

  if (request.method === "POST" && path === "/admin/kb/ingest") {
    const body = await request.json().catch(() => null);
    if (!body?.sourceId) return respond({ error: "sourceId required" }, h, 400);
    const result = await ingestKbDocument(env, {
      projectId,
      sourceId: body.sourceId,
      title: body.title,
      content: body.content,
      url: body.url,
      author: userId,
    });
    if (result.error) return respond(result, h, 400);
    return respond(result, h, 201);
  }

  if (request.method === "GET" && path === "/admin/kb/search") {
    const query = url.searchParams.get("q") || "";
    const sourceId = url.searchParams.get("sourceId") || undefined;
    const limit = parseInt(url.searchParams.get("limit") || "10", 10);
    const hits = await searchKbDocuments(env, { projectId, query, sourceId, limit });
    return respond({ hits, count: hits.length }, h);
  }

  if (request.method === "POST" && path === "/admin/kb/rag") {
    const body = await request.json().catch(() => null);
    const query = body?.query?.trim();
    if (!query) return respond({ error: "query required" }, h, 400);
    const hits = await searchKbDocuments(env, {
      projectId,
      query,
      sourceId: body?.sourceId,
      limit: body?.maxResults ?? 5,
    });
    const rag = buildRagContextFromHits(hits, query);
    return respond(rag, h);
  }

  return null;
}
