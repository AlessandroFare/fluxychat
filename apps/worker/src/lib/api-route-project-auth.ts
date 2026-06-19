import { json } from "./http-json.js";
import { depsEnv } from "./deps-env.js";
import { requireAdminJwt } from "./route-jwt-auth.js";

interface RouteAuthHandlers {
  verifyJwtAndGetContext?: (
    request: Request,
    env: unknown,
  ) => Promise<{ auth?: { projectId: string }; response?: Response }>;
  hasAnyRole?: (auth: unknown, roles: string[]) => boolean;
  json?: (
    data: unknown,
    init?: number | { status?: number; headers?: Record<string, string> },
  ) => Response;
}

/**
 * Require owner/admin JWT for /api/* routes and bind tenant from auth (not query).
 */
export async function requireApiProjectAdmin(request: Request, h: RouteAuthHandlers) {
  const env = depsEnv(h);
  const verifyJwtAndGetContext = h?.verifyJwtAndGetContext;
  const hasAnyRole = h?.hasAnyRole;
  const respond = h?.json ?? json;
  if (!verifyJwtAndGetContext || !hasAnyRole) {
    return { response: respond({ error: "misconfigured_route_auth" }, { status: 500 }) };
  }
  const gate = await requireAdminJwt(
    request,
    verifyJwtAndGetContext,
    env,
    respond,
    hasAnyRole,
  );
  if (gate.response) return gate;
  return { auth: gate.auth, projectId: gate.auth.projectId, env };
}

/**
 * Force projectId on outbound payloads to the authenticated tenant.
 */
export function withAuthProjectId<T extends Record<string, unknown>>(
  body: T | null | undefined,
  projectId: string,
): T & { projectId: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { projectId } as T & { projectId: string };
  }
  return { ...body, projectId };
}
