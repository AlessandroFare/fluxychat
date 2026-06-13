/**
 * Shared JWT auth helpers for HTTP route modules.
 */
export async function verifyJwtOrNull(request, verifyJwtAndGetContext, env) {
  try {
    return await verifyJwtAndGetContext(request, env);
  } catch {
    return null;
  }
}

export function rolesInclude(auth, hasAnyRole, allowedRoles) {
  if (!auth?.roles) return false;
  return hasAnyRole(auth.roles, allowedRoles);
}

export async function requireJwt(request, verifyJwtAndGetContext, env, json) {
  const auth = await verifyJwtOrNull(request, verifyJwtAndGetContext, env);
  if (!auth) {
    return { response: json({ error: "unauthorized" }, { status: 401 }) };
  }
  return { auth };
}

export async function requireAdminJwt(
  request,
  verifyJwtAndGetContext,
  env,
  json,
  hasAnyRole,
  allowedRoles = ["owner", "admin"],
) {
  const gate = await requireJwt(request, verifyJwtAndGetContext, env, json);
  if (gate.response) return gate;
  if (!rolesInclude(gate.auth, hasAnyRole, allowedRoles)) {
    return { response: json({ error: "forbidden" }, { status: 403 }) };
  }
  return { auth: gate.auth };
}
