import { pickRouteDeps } from "./route-http-deps.js";
import {
  unifiedSearch,
  saveSearch,
  listSavedSearches,
  deleteSavedSearch,
  recordSearchUse,
  createFolder,
  listFolders,
  addToFolder,
  removeFromFolder,
  getFolderItems,
  deleteFolder,
} from "../lib/search-enhancements.js";

export async function dispatchSearchEnhancementsRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
  } = pickRouteDeps(h, [
    "env", "json", "corsHeaders", "requestLogCtx", "verifyJwtAndGetContext", "logError",
  ]);

  const searchMatch = url.pathname === "/search/unified";
  const savedMatch = url.pathname === "/search/saved";
  const savedIdMatch = url.pathname.match(/^\/search\/saved\/([^/]+)$/);
  const savedUseMatch = url.pathname.match(/^\/search\/saved\/([^/]+)\/use$/);
  const foldersMatch = url.pathname === "/search/folders";
  const folderItemsMatch = url.pathname.match(/^\/search\/folders\/([^/]+)$/);
  const folderAddMatch = url.pathname.match(/^\/search\/folders\/([^/]+)\/items$/);
  const folderRemoveMatch = url.pathname.match(/^\/search\/folders\/([^/]+)\/items\/([^/]+)$/);

  if (!searchMatch && !savedMatch && !savedIdMatch && !savedUseMatch && !foldersMatch && !folderItemsMatch && !folderAddMatch && !folderRemoveMatch) {
    return null;
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    /* ── POST /search/unified ── */
    if (searchMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await unifiedSearch(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        roles: auth.roles,
        query: body?.query || "",
        roomId: body?.roomId || undefined,
        userIdFilter: body?.userIdFilter || undefined,
        from: body?.from || undefined,
        to: body?.to || undefined,
        limit: body?.limit || undefined,
        mode: body?.mode || "hybrid",
      });
      if (!result.ok) {
        const status = result.error === "query_required" ? 400 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── GET /search/saved ── */
    if (savedMatch && request.method === "GET") {
      const result = await listSavedSearches(env, { projectId: auth.projectId, userId: auth.userId });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /search/saved ── */
    if (savedMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await saveSearch(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        name: body?.name,
        query: body?.query,
        filters: body?.filters,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── DELETE /search/saved/:id ── */
    if (savedIdMatch && request.method === "DELETE") {
      const result = await deleteSavedSearch(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        searchId: savedIdMatch[1],
      });
      if (!result.ok) {
        const status = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /search/saved/:id/use ── */
    if (savedUseMatch && request.method === "POST") {
      await recordSearchUse(env, savedUseMatch[1]);
      return json({ ok: true }, { headers: corsHeaders });
    }

    /* ── GET /search/folders ── */
    if (foldersMatch && request.method === "GET") {
      const result = await listFolders(env, { projectId: auth.projectId, userId: auth.userId });
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /search/folders ── */
    if (foldersMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await createFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        name: body?.name,
        description: body?.description,
      });
      if (!result.ok) return json({ error: result.error }, { status: 400, headers: corsHeaders });
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── GET /search/folders/:id ── */
    if (folderItemsMatch && !folderAddMatch && !folderRemoveMatch && request.method === "GET") {
      const result = await getFolderItems(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: folderItemsMatch[1],
      });
      if (!result.ok) {
        const status = result.error === "folder_not_found" ? 404 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── DELETE /search/folders/:id ── */
    if (folderItemsMatch && !folderAddMatch && !folderRemoveMatch && request.method === "DELETE") {
      const result = await deleteFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: folderItemsMatch[1],
      });
      if (!result.ok) {
        const status = result.error === "not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    /* ── POST /search/folders/:id/items ── */
    if (folderAddMatch && request.method === "POST") {
      const body = await request.json().catch(() => null);
      const result = await addToFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: folderAddMatch[1],
        searchId: body?.searchId,
      });
      if (!result.ok) {
        const status = result.error === "folder_not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    /* ── DELETE /search/folders/:folderId/items/:searchId ── */
    if (folderRemoveMatch && request.method === "DELETE") {
      const result = await removeFromFolder(env, {
        projectId: auth.projectId,
        userId: auth.userId,
        folderId: folderRemoveMatch[1],
        searchId: folderRemoveMatch[2],
      });
      if (!result.ok) {
        const status = result.error === "folder_not_found" ? 404 : result.error === "forbidden" ? 403 : 400;
        return json({ error: result.error }, { status, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("search_enhancements.unhandled", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
