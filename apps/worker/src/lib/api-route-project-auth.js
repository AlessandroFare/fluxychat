export function withAuthProjectId(payload, projectId) {
  return { ...(payload && typeof payload === "object" ? payload : {}), projectId };
}

export async function requireApiProjectAdmin(request, h) {
  const { env, verifyJwtAndGetContext, hasAnyRole } = h;
  const auth = await verifyJwtAndGetContext(request, env).catch(() => null);
  if (!auth) {
    return { response: new Response("Unauthorized", { status: 401 }) };
  }
  if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
    return { response: new Response("Forbidden", { status: 403 }) };
  }
  return { env, projectId: auth.projectId, auth };
}
