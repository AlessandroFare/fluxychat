import { json } from "../lib/http-json.js";
import * as Advanced from "../lib/companion-advanced.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchCompanionAdvancedRoutes(request, url, h) {
  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;
  const path = url.pathname;

  if (path === "/api/companion-advanced/conversations" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.createConversation(env, body);
    return json(result);
  }

  if (path === "/api/companion-advanced/conversations" && request.method === "GET") {
    const result = await Advanced.listConversations(env, {
      projectId,
      roomId: url.searchParams.get("roomId"),
      status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+$/) && request.method === "GET") {
    const conversationId = path.split("/").pop();
    const result = await Advanced.getConversation(env, { conversationId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/end$/) && request.method === "POST") {
    const conversationId = path.split("/")[3];
    const result = await Advanced.endConversation(env, { conversationId });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/participants$/) && request.method === "POST") {
    const conversationId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.addParticipant(env, { conversationId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/participants$/) && request.method === "GET") {
    const conversationId = path.split("/")[3];
    const result = await Advanced.listParticipants(env, { conversationId });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/participants\/remove$/) && request.method === "POST") {
    const conversationId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.removeParticipant(env, { conversationId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/messages$/) && request.method === "POST") {
    const conversationId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.sendCompanionMessage(env, { conversationId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/conversations\/[a-z0-9]+\/messages$/) && request.method === "GET") {
    const conversationId = path.split("/")[3];
    const result = await Advanced.listConversationMessages(env, {
      conversationId,
      limit: parseInt(url.searchParams.get("limit") || "50"),
      before: url.searchParams.get("before"),
    });
    return json(result);
  }

  if (path === "/api/companion-advanced/personality" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.logPersonalityShift(env, body);
    return json(result);
  }

  if (path === "/api/companion-advanced/personality" && request.method === "GET") {
    const result = await Advanced.getPersonalityHistory(env, {
      companionId: url.searchParams.get("companionId"),
      trait: url.searchParams.get("trait"),
      limit: parseInt(url.searchParams.get("limit") || "20"),
    });
    return json(result);
  }

  if (path === "/api/companion-advanced/emotions" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.setEmotionState(env, body);
    return json(result);
  }

  if (path === "/api/companion-advanced/emotions" && request.method === "GET") {
    const result = await Advanced.getRecentEmotions(env, {
      companionId: url.searchParams.get("companionId"),
      roomId: url.searchParams.get("roomId"),
      limit: parseInt(url.searchParams.get("limit") || "10"),
    });
    return json(result);
  }

  if (path === "/api/companion-advanced/emotions/current" && request.method === "GET") {
    const result = await Advanced.getCurrentEmotion(env, {
      companionId: url.searchParams.get("companionId"),
      roomId: url.searchParams.get("roomId"),
    });
    return json(result);
  }

  if (path === "/api/companion-advanced/delegations" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.createDelegation(env, body);
    return json(result);
  }

  if (path === "/api/companion-advanced/delegations" && request.method === "GET") {
    const result = await Advanced.listDelegations(env, {
      projectId,
      roomId: url.searchParams.get("roomId"),
      status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/companion-advanced\/delegations\/[a-z0-9]+\/resolve$/) && request.method === "POST") {
    const delegationId = path.split("/")[3];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Advanced.resolveDelegation(env, { delegationId, ...body });
    return json(result);
  }

  if (path === "/api/companion-advanced/stats" && request.method === "GET") {
    const result = await Advanced.getAdvancedStats(env, { projectId });
    return json(result);
  }

  return null;
}
