import { pickRouteDeps } from "./route-http-deps.js";
import {
  approveWriteIntent,
  createWriteIntent,
  ingestIntegrationWebhook,
  integrationCatalog,
  linkEntityRoom,
  listIntegrationConnections,
  setIntegrationKillSwitch,
  signatureHeaderFor,
  upsertIntegrationConnection,
} from "../lib/integration-kit.js";

export async function dispatchIntegrationKitRoutes(request, url, h) {
  const path = url.pathname;
  const ours =
    path === "/integrations/catalog" ||
    path === "/integrations/connections" ||
    path === "/integrations/entity-links" ||
    path === "/integrations/write-intents" ||
    path.startsWith("/integrations/webhooks/") ||
    path.startsWith("/integrations/connections/") ||
    path.startsWith("/integrations/write-intents/");
  if (!ours) return null;

  const {
    env,
    json,
    corsHeaders,
    verifyJwtAndGetContext,
    hasAnyRole,
    canAccessRoom,
    logError,
    requestLogCtx,
  } = pickRouteDeps(h, [
    "env",
    "json",
    "corsHeaders",
    "verifyJwtAndGetContext",
    "hasAnyRole",
    "canAccessRoom",
    "logError",
    "requestLogCtx",
  ]);

  const hook = path.match(/^\/integrations\/webhooks\/([^/]+)\/([^/]+)$/);
  if (hook && request.method === "POST") {
    const projectId = decodeURIComponent(hook[1]);
    const provider = decodeURIComponent(hook[2]).toLowerCase();
    const rawBody = await request.text();
    const signature = signatureHeaderFor(provider, request);
    const result = await ingestIntegrationWebhook(env, {
      projectId,
      provider,
      rawBody,
      signature,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (path === "/integrations/catalog" && request.method === "GET") {
    return json({ providers: integrationCatalog() }, { headers: corsHeaders });
  }

  const auth = await verifyJwtAndGetContext(request, env).catch((err) => {
    if (err instanceof Response) throw err;
    logError("auth.jwt_verify_failed", err, requestLogCtx);
    return null;
  });
  if (!auth) {
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  if (path === "/integrations/connections" && request.method === "GET") {
    const connections = await listIntegrationConnections(env, { projectId: auth.projectId });
    return json({ connections }, { headers: corsHeaders });
  }

  if (path === "/integrations/connections" && request.method === "PUT") {
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const result = await upsertIntegrationConnection(env, {
      projectId: auth.projectId,
      provider: body.provider,
      signingSecret: body.signingSecret,
      writeToken: body.writeToken,
      jiraEmail: body.jiraEmail,
      jiraSite: body.jiraSite,
      killSwitch: body.killSwitch,
      noTrain: body.noTrain,
      scopes: body.scopes,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  const kill = path.match(/^\/integrations\/connections\/([^/]+)\/kill$/);
  if (kill && request.method === "POST") {
    if (!hasAnyRole(auth.roles, ["owner", "admin"])) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const body = await request.json().catch(() => ({}));
    const result = await setIntegrationKillSwitch(env, {
      projectId: auth.projectId,
      provider: decodeURIComponent(kill[1]),
      killSwitch: body.killSwitch !== false,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (path === "/integrations/entity-links" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const roomId = body.roomId;
    if (!roomId || !(await canAccessRoom(env, auth, roomId))) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const result = await linkEntityRoom(env, {
      projectId: auth.projectId,
      roomId,
      entity: body.entity,
      ref: body.ref,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  if (path === "/integrations/write-intents" && request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    const roomId = body.roomId;
    if (!roomId || !(await canAccessRoom(env, auth, roomId))) {
      return json({ error: "forbidden" }, { status: 403, headers: corsHeaders });
    }
    const result = await createWriteIntent(env, {
      projectId: auth.projectId,
      roomId,
      provider: body.provider,
      action: body.action,
      title: body.title,
      body: body.body,
      repo: body.repo,
      teamId: body.teamId,
      projectKey: body.projectKey,
      dryRun: body.dryRun,
      execute: body.execute,
      requestedBy: auth.userId,
      agentId: body.agentId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  const approve = path.match(/^\/integrations\/write-intents\/([^/]+)\/approve$/);
  if (approve && request.method === "POST") {
    const result = await approveWriteIntent(env, {
      projectId: auth.projectId,
      intentId: decodeURIComponent(approve[1]),
      userId: auth.userId,
    });
    if (!result.ok) {
      return json({ error: result.error }, { status: result.status || 400, headers: corsHeaders });
    }
    return json(result, { headers: corsHeaders });
  }

  return json({ error: "method_not_allowed" }, { status: 405, headers: corsHeaders });
}
