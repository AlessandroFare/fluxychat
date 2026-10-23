import { pickRouteDeps } from "./route-http-deps.js";
import {
  addUserGroupMembers,
  createUserGroup,
  deleteUserGroup,
  listUserGroups,
  removeUserGroupMember,
} from "../lib/user-groups.js";

/**
 * Custom user groups (mentionable as @group:<name>).
 * GET    /user-groups
 * POST   /user-groups                       (admin)
 * DELETE /user-groups/:id                   (admin)
 * POST   /user-groups/:id/members           (admin)
 * DELETE /user-groups/:id/members/:userId   (admin)
 */
export async function dispatchUserGroupsRoutes(request, url, h) {
  const {
    env,
    json,
    corsHeaders,
    requestLogCtx,
    verifyJwtAndGetContext,
    hasAnyRole,
    logError,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "requestLogCtx",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "logError",
  ]);

  const listMatch = url.pathname === "/user-groups";
  const membersMatch = url.pathname.match(/^\/user-groups\/([^/]+)\/members$/);
  const memberMatch = url.pathname.match(/^\/user-groups\/([^/]+)\/members\/([^/]+)$/);
  const itemMatch = url.pathname.match(/^\/user-groups\/([^/]+)$/);
  if (!listMatch && !membersMatch && !memberMatch && !itemMatch) return null;

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  try {
    if (listMatch && request.method === "GET") {
      const { groups } = await listUserGroups(env, { projectId: auth.projectId });
      return json({ groups, count: groups.length }, { headers: corsHeaders });
    }

    const isAdmin = hasAnyRole(auth.roles || [], ["owner", "admin"]);
    const deny = () => json({ error: "forbidden" }, { status: 403, headers: corsHeaders });

    if (listMatch && request.method === "POST") {
      if (!isAdmin) return deny();
      const body = await request.json().catch(() => null);
      const result = await createUserGroup(env, {
        projectId: auth.projectId,
        name: body?.name,
        memberIds: body?.memberIds,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { status: 201, headers: corsHeaders });
    }

    if (itemMatch && request.method === "DELETE") {
      if (!isAdmin) return deny();
      const result = await deleteUserGroup(env, {
        projectId: auth.projectId,
        groupId: decodeURIComponent(itemMatch[1]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (membersMatch && request.method === "POST") {
      if (!isAdmin) return deny();
      const body = await request.json().catch(() => null);
      const result = await addUserGroupMembers(env, {
        projectId: auth.projectId,
        groupId: decodeURIComponent(membersMatch[1]),
        userIds: body?.userIds,
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    if (memberMatch && request.method === "DELETE") {
      if (!isAdmin) return deny();
      const result = await removeUserGroupMember(env, {
        projectId: auth.projectId,
        groupId: decodeURIComponent(memberMatch[1]),
        userId: decodeURIComponent(memberMatch[2]),
      });
      if (!result.ok) {
        return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
      }
      return json(result, { headers: corsHeaders });
    }

    return null;
  } catch (err) {
    logError("user_groups.route_error", err, requestLogCtx);
    return json({ error: "internal_error" }, { status: 500, headers: corsHeaders });
  }
}
