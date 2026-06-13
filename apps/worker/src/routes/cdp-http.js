import { json } from "../lib/http-json.js";
import * as CDP from "../lib/customer-data.js";
import {
  requireApiProjectAdmin,
  withAuthProjectId,
} from "../lib/api-route-project-auth.js";

export async function dispatchCDPRoutes(request, url, h) {
  const gate = await requireApiProjectAdmin(request, h);
  if (gate.response) return gate.response;
  const { env, projectId } = gate;
  const path = url.pathname;

  if (path === "/api/cdp/customers" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.upsertCustomer(env, body);
    return json(result);
  }

  if (path === "/api/cdp/customers" && request.method === "GET") {
    const result = await CDP.listCustomers(env, {
      projectId, lifecycleStage: url.searchParams.get("lifecycleStage"),
      search: url.searchParams.get("search"),
      limit: parseInt(url.searchParams.get("limit") || "25"),
      offset: parseInt(url.searchParams.get("offset") || "0"),
    });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/customers\/[a-z0-9]+$/) && request.method === "GET") {
    const customerId = path.split("/").pop();
    const result = await CDP.getCustomerById(env, { customerId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/cdp\/customers\/[a-z0-9]+\/score$/) && request.method === "POST") {
    const customerId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.updateCustomerScore(env, { customerId, ...body });
    return json(result);
  }

  if (path === "/api/cdp/events" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.trackEvent(env, body);
    return json(result);
  }

  if (path === "/api/cdp/events" && request.method === "GET") {
    const result = await CDP.listCustomerEvents(env, {
      customerId: url.searchParams.get("customerId"),
      eventType: url.searchParams.get("eventType"),
      eventName: url.searchParams.get("eventName"),
      limit: parseInt(url.searchParams.get("limit") || "50"),
    });
    return json(result);
  }

  if (path === "/api/cdp/events/counts" && request.method === "GET") {
    const result = await CDP.getEventCounts(env, {
      projectId, eventName: url.searchParams.get("eventName"),
      days: parseInt(url.searchParams.get("days") || "30"),
    });
    return json(result);
  }

  if (path === "/api/cdp/segments" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.createSegment(env, body);
    return json(result);
  }

  if (path === "/api/cdp/segments" && request.method === "GET") {
    const result = await CDP.listSegments(env, { projectId, status: url.searchParams.get("status") });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/segments\/[a-z0-9]+$/) && request.method === "GET") {
    const segmentId = path.split("/").pop();
    const result = await CDP.getSegment(env, { segmentId });
    return result ? json(result) : json({ error: "not_found" }, 404);
  }

  if (path.match(/^\/api\/cdp\/segments\/[a-z0-9]+$/) && request.method === "PATCH") {
    const segmentId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.updateSegment(env, { segmentId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/segments\/[a-z0-9]+\/members$/) && request.method === "POST") {
    const segmentId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.addSegmentMember(env, { segmentId, ...body });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/segments\/[a-z0-9]+\/members$/) && request.method === "GET") {
    const segmentId = path.split("/")[4];
    const result = await CDP.listSegmentMembers(env, { segmentId, limit: parseInt(url.searchParams.get("limit") || "100") });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/segments\/[a-z0-9]+\/members\/remove$/) && request.method === "POST") {
    const segmentId = path.split("/")[4];
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.removeSegmentMember(env, { segmentId, ...body });
    return json(result);
  }

  if (path === "/api/cdp/broadcasts" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.createBroadcast(env, body);
    return json(result);
  }

  if (path === "/api/cdp/broadcasts" && request.method === "GET") {
    const result = await CDP.listBroadcasts(env, { projectId, status: url.searchParams.get("status") });
    return json(result);
  }

  if (path.match(/^\/api\/cdp\/broadcasts\/[a-z0-9]+$/) && request.method === "PATCH") {
    const broadcastId = path.split("/").pop();
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.updateBroadcast(env, { broadcastId, ...body });
    return json(result);
  }

  if (path === "/api/cdp/properties" && request.method === "POST") {
    const body = withAuthProjectId(await request.json(), projectId);
    const result = await CDP.defineProperty(env, body);
    return json(result);
  }

  if (path === "/api/cdp/properties" && request.method === "GET") {
    const result = await CDP.listProperties(env, { projectId });
    return json(result);
  }

  if (path === "/api/cdp/stats" && request.method === "GET") {
    const result = await CDP.getCustomerStats(env, { projectId });
    return json(result);
  }

  return null;
}
