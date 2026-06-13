import { json } from "../lib/http-json.js";
import * as Replay from "../lib/replay-timetravel.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchReplayRoutes(request, url, h) {
  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;
  const path = url.pathname;

  if (path === "/api/replay/sessions" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.createSession(env, body);
    return json(result);
  }

  if (path === "/api/replay/sessions" && request.method === "GET") {
    const result = await Replay.listSessions(env, {
      projectId, roomId: url.searchParams.get("roomId"), status: url.searchParams.get("status"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+$/) && request.method === "GET") {
    const sessionId = path.split("/").pop();
    const result = await Replay.getSession(env, { sessionId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+$/) && request.method === "PATCH") {
    const sessionId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.updateSession(env, { sessionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/snapshots$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.createSnapshot(env, { sessionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/snapshots$/) && request.method === "GET") {
    const sessionId = path.split("/")[4];
    const result = await Replay.listSnapshots(env, {
      sessionId, limit: parseInt(url.searchParams.get("limit") || "50"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/snapshots\/[a-z0-9]+$/) && request.method === "GET") {
    const snapshotId = path.split("/").pop();
    const result = await Replay.getSnapshot(env, { snapshotId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/replay\/snapshots\/sequence$/) && request.method === "GET") {
    const result = await Replay.getSnapshotAtSequence(env, {
      sessionId: url.searchParams.get("sessionId"),
      sequenceNumber: parseInt(url.searchParams.get("sequenceNumber") || "0"),
    });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/events$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.recordEvent(env, { sessionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/events$/) && request.method === "GET") {
    const sessionId = path.split("/")[4];
    const result = await Replay.listEvents(env, {
      sessionId, eventType: url.searchParams.get("eventType"),
      fromSequence: url.searchParams.get("fromSequence") ? parseInt(url.searchParams.get("fromSequence")) : undefined,
      toSequence: url.searchParams.get("toSequence") ? parseInt(url.searchParams.get("toSequence")) : undefined,
      limit: parseInt(url.searchParams.get("limit") || "100"),
    });
    return json(result);
  }

  if (path === "/api/replay/events/range" && request.method === "GET") {
    const result = await Replay.getEventsInRange(env, {
      sessionId: url.searchParams.get("sessionId"),
      fromTime: url.searchParams.get("fromTime"),
      toTime: url.searchParams.get("toTime"),
      limit: parseInt(url.searchParams.get("limit") || "500"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/bookmarks$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.createBookmark(env, { sessionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/bookmarks$/) && request.method === "GET") {
    const sessionId = path.split("/")[4];
    const result = await Replay.listBookmarks(env, { sessionId });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/diffs$/) && request.method === "POST") {
    const sessionId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await Replay.createDiff(env, { sessionId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/replay\/sessions\/[a-z0-9]+\/diffs$/) && request.method === "GET") {
    const sessionId = path.split("/")[4];
    const result = await Replay.listDiffs(env, { sessionId });
    return json(result);
  }

  if (path === "/api/replay/stats" && request.method === "GET") {
    const result = await Replay.getReplayStats(env, { projectId });
    return json(result);
  }

  return null;
}
