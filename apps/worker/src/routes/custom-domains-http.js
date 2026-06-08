import { pickRouteDeps } from "./route-http-deps.js";
import {
  createCustomDomain,
  deleteCustomDomain,
  listCustomDomainsForProject,
  updateCustomDomain,
} from "../lib/custom-domains.js";

export async function dispatchCustomDomainsRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    logError,
    hasAnyRole,
    isValidId,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "logError",
    "hasAnyRole",
    "isValidId",
  ]);

  if (url.pathname === "/admin/custom-domains" && request.method === "GET") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const domains = await listCustomDomainsForProject(env, auth.projectId);
    return json({ domains }, { headers: corsHeaders });
  }

  if (url.pathname === "/admin/custom-domains" && request.method === "POST") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const body = await request.json().catch(() => null);
    const defaultRoomId =
      typeof body?.defaultRoomId === "string" && isValidId(body.defaultRoomId)
        ? body.defaultRoomId
        : null;
    const allowedOrigins = Array.isArray(body?.allowedOrigins)
      ? body.allowedOrigins.filter((o) => typeof o === "string")
      : undefined;

    const result = await createCustomDomain(env, {
      projectId: auth.projectId,
      hostname: typeof body?.hostname === "string" ? body.hostname : "",
      defaultRoomId,
      brandName: typeof body?.brandName === "string" ? body.brandName : null,
      brandLogoUrl: typeof body?.brandLogoUrl === "string" ? body.brandLogoUrl : null,
      allowedOrigins,
    });
    if (!result.ok) {
      const status = result.error === "hostname_taken" ? 409 : 400;
      return json({ error: result.error }, { status, headers: corsHeaders });
    }
    return json(result.domain, { status: 201, headers: corsHeaders });
  }

  const domainMatch = url.pathname.match(/^\/admin\/custom-domains\/([^/]+)$/);
  if (domainMatch && request.method === "PATCH") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const domainId = decodeURIComponent(domainMatch[1]);
    const body = await request.json().catch(() => null);
    const result = await updateCustomDomain(env, {
      projectId: auth.projectId,
      domainId,
      status: typeof body?.status === "string" ? body.status : undefined,
      defaultRoomId:
        body?.defaultRoomId === null
          ? null
          : typeof body?.defaultRoomId === "string" && isValidId(body.defaultRoomId)
            ? body.defaultRoomId
            : undefined,
      brandName: typeof body?.brandName === "string" ? body.brandName : undefined,
      brandLogoUrl:
        typeof body?.brandLogoUrl === "string" ? body.brandLogoUrl : undefined,
      allowedOrigins: Array.isArray(body?.allowedOrigins)
        ? body.allowedOrigins.filter((o) => typeof o === "string")
        : undefined,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json(result.domain, { headers: corsHeaders });
  }

  if (domainMatch && request.method === "DELETE") {
    const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
      if (err instanceof Response) throw err;
      logError("auth.jwt_verify_failed", err, requestLogCtx);
      return null;
    });
    if (!auth) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }

    const domainId = decodeURIComponent(domainMatch[1]);
    const result = await deleteCustomDomain(env, {
      projectId: auth.projectId,
      domainId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: 404, headers: corsHeaders });
    }
    return json({ ok: true }, { headers: corsHeaders });
  }

  return null;
}
