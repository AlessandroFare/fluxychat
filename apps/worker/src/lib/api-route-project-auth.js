export function withAuthProjectId(payload, projectId) {
  return { ...(payload && typeof payload === "object" ? payload : {}), projectId };
}

function authErrorResponse(status, corsHeaders) {
  return new Response(status === 401 ? "Unauthorized" : "Forbidden", {
    status,
    headers: corsHeaders ?? {},
  });
}

export async function requireApiProjectAdmin(request, h) {
  const { env, verifyJwtAndGetContext, hasAnyRole, corsHeaders } = h;
  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return { response: authErrorResponse(401, corsHeaders) };
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
    return { response: authErrorResponse(403, corsHeaders) };
  }
  return { env, projectId: auth.projectId, auth };
}

/** Any authenticated project member (demo guest, console user, etc.). */
export async function requireApiProjectMember(request, h) {
  const { env, verifyJwtAndGetContext, hasAnyRole, corsHeaders } = h;
  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return { response: authErrorResponse(401, corsHeaders) };
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin", "member", "guest"])) {
    return { response: authErrorResponse(403, corsHeaders) };
  }
  return { env, projectId: auth.projectId, auth };
}
