/**
 * Project LLM provider catalog and credentials
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";

export async function dispatchLlmRoutes(request, url, h) {
  const {
    env,
    corsHeaders,
    json,
    verifyJwtAndGetContext,
    projectId,
    listLlmProvidersForApi,
  } = pickRouteDeps(h, [
    "env",
    "corsHeaders",
    "json",
    "verifyJwtAndGetContext",
    "projectId",
    "listLlmProvidersForApi",
  ]);

  if (url.pathname === "/llm/providers" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const live = url.searchParams.get("live") === "1" || url.searchParams.get("live") === "true";
    const { listProjectLlmCredentials } = await import("../lib/project-llm-credentials.js");
    const projectCredentials = await listProjectLlmCredentials(env, auth.projectId);
    const catalog = await listLlmProvidersForApi(env, {
      projectId: auth.projectId,
      live,
      projectCredentials,
    });
    return json(catalog);
  }

  if (url.pathname === "/projects/llm/credentials" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const { listProjectLlmCredentials } = await import("../lib/project-llm-credentials.js");
    const credentials = await listProjectLlmCredentials(env, auth.projectId);
    return json({ credentials });
  }

  if (
    url.pathname.startsWith("/projects/llm/credentials/") &&
    request.method === "PUT"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const providerId = url.pathname.split("/").pop();
    const body = await request.json().catch(() => ({}));
    try {
      const { upsertProjectLlmCredential } = await import("../lib/project-llm-credentials.js");
      const row = await upsertProjectLlmCredential(env, auth.projectId, providerId, {
        apiKey: body.apiKey,
        baseUrl: body.baseUrl,
        clearApiKey: body.clearApiKey === true,
      });
      return json({ credential: row });
    } catch (err) {
      const message = err instanceof Error ? err.message : "credential_update_failed";
      const status =
        message === "encryption_not_configured"
          ? 503
          : message === "unknown_provider"
            ? 400
            : 500;
      return json({ error: message }, { status });
    }
  }

  if (
    url.pathname.startsWith("/projects/llm/credentials/") &&
    request.method === "DELETE"
  ) {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const providerId = url.pathname.split("/").pop();
    const { deleteProjectLlmCredential } = await import("../lib/project-llm-credentials.js");
    await deleteProjectLlmCredential(env, auth.projectId, providerId);
    return json({ ok: true });
  }

  return null;
}
