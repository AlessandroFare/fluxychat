import { json } from "../lib/http-json.js";
import * as Live from "../lib/live-streaming.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchLiveStreamingRoutes(request, url, h) {
  const path = url.pathname;
  if (!path.startsWith("/api/live")) return null;

  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;

  if (path === "/api/live/events" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.createEvent(env, body);
    return json(result);
  }

  if (path === "/api/live/events" && request.method === "GET") {
    const result = await Live.listEvents(env, {
      projectId, status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+$/) && request.method === "GET") {
    const eventId = path.split("/").pop();
    const result = await Live.getEvent(env, { eventId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+$/) && request.method === "PATCH") {
    const eventId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.updateEvent(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/rules$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.upsertChatRules(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/rules$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getChatRules(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/join$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.joinEvent(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/leave$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.leaveEvent(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/viewers$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listViewers(env, {
      eventId, role: url.searchParams.get("role"),
      limit: parseInt(url.searchParams.get("limit") || "100"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/viewer-count$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getViewerCount(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/peak$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getPeakViewers(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/peak$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const result = await Live.updateViewerPeak(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/ban$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.banViewer(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/mute$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.muteViewer(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/pin$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.pinMessage(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/unpin$/) && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.unpinMessage(env, body);
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/pinned$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listPinnedMessages(env, { eventId });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/messages$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.sendLiveMessage(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/messages$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.listLiveMessages(env, {
      eventId, limit: parseInt(url.searchParams.get("limit") || "100"),
      before: url.searchParams.get("before"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/analytics$/) && request.method === "POST") {
    const eventId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Live.recordAnalyticsBucket(env, { eventId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/live\/events\/[a-z0-9]+\/analytics$/) && request.method === "GET") {
    const eventId = path.split("/")[4];
    const result = await Live.getEventAnalytics(env, {
      eventId, fromBucket: url.searchParams.get("fromBucket"), toBucket: url.searchParams.get("toBucket"),
    });
    return json(result);
  }

  if (path === "/api/live/stats" && request.method === "GET") {
    const result = await Live.getLiveStats(env, { projectId });
    return json(result);
  }

  return null;
}
