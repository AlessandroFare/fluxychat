import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps, unauthorizedRequest } from "./auth-matrix-deps.js";
import { dispatchMessagesRoutes } from "./messages-http.js";
import { dispatchAgentsRoutes } from "./agents-http.js";
import { dispatchReportsWebhooksRoutes } from "./reports-webhooks-http.js";
import { dispatchInboxRoutes } from "./inbox-http.js";
import { dispatchNotificationsRoutes } from "./notifications-http.js";
import { dispatchSearchRoutes } from "./search-http.js";
import { dispatchAgentQueueRoutes } from "./agent-queue-http.js";
import { dispatchHandoffRoutes } from "./handoff-http.js";
import { dispatchRoomsListExportRoutes } from "./rooms-list-export-http.js";
import { dispatchRoomsMutationsRoutes } from "./rooms-mutations-http.js";
import { dispatchAdminSearchAutomationRoutes } from "./admin-search-automation-http.js";
import { dispatchDigestRoutes } from "./digest-http.js";
import { dispatchActivitiesRoutes } from "./activities-http.js";
import { dispatchPresenceRoutes } from "./presence-http.js";
import { dispatchPushRoutes } from "./push-http.js";
import { dispatchVoiceMessagesRoutes } from "./voice-messages-http.js";
import { dispatchVoiceAiRoutes } from "./voice-ai-http.js";
import { dispatchUserBlocksRoutes } from "./user-blocks-http.js";
import { dispatchLlmRoutes } from "./llm-http.js";
import { dispatchDevtoolsRoutes } from "./devtools-http.js";
import { dispatchThreadStateRoutes } from "./thread-state-http.js";
import { dispatchThreadSummaryRoutes } from "./thread-summary-http.js";
import { dispatchEventsRoutes } from "./events-http.js";
import { dispatchScheduledAdminRoutes } from "./scheduled-admin-http.js";
import { dispatchRoomMemoryRoutes } from "./room-memory-http.js";
import { dispatchEmbedRoutes } from "./embed-http.js";

const cases401 = [
  {
    name: "POST /messages",
    dispatch: dispatchMessagesRoutes,
    request: () => unauthorizedRequest("/messages", { method: "POST", body: { roomId: "room-1", content: "hi" } }),
  },
  {
    name: "POST /bots",
    dispatch: dispatchAgentsRoutes,
    request: () => unauthorizedRequest("/bots", { method: "POST", body: { name: "Helper" } }),
  },
  {
    name: "POST /agents/:id/invoke",
    dispatch: dispatchAgentsRoutes,
    request: () =>
      unauthorizedRequest("/agents/bot-1/invoke", {
        method: "POST",
        body: { roomId: "room-1", content: "hi" },
      }),
  },
  {
    name: "GET /agents/:id/copilot",
    dispatch: dispatchAgentsRoutes,
    request: () => unauthorizedRequest("/agents/bot-1/copilot"),
  },
  {
    name: "POST /webhooks/register",
    dispatch: dispatchReportsWebhooksRoutes,
    request: () =>
      unauthorizedRequest("/webhooks/register", {
        method: "POST",
        body: { url: "https://example.com/hook", eventTypes: ["message.created"] },
      }),
  },
  {
    name: "POST /reports",
    dispatch: dispatchReportsWebhooksRoutes,
    request: () =>
      unauthorizedRequest("/reports", {
        method: "POST",
        body: { messageId: 1, roomId: "room-1" },
      }),
  },
  {
    name: "POST /rooms",
    dispatch: dispatchRoomsMutationsRoutes,
    request: () => unauthorizedRequest("/rooms", { method: "POST", body: { name: "General", type: "public" } }),
  },
  {
    name: "GET /inbox",
    dispatch: dispatchInboxRoutes,
    request: () => unauthorizedRequest("/inbox"),
  },
  {
    name: "GET /notifications",
    dispatch: dispatchNotificationsRoutes,
    request: () => unauthorizedRequest("/notifications"),
  },
  {
    name: "GET /search/messages",
    dispatch: dispatchSearchRoutes,
    request: () => unauthorizedRequest("/search/messages?q=hi"),
  },
  {
    name: "GET /agent-queue/dispositions",
    dispatch: dispatchAgentQueueRoutes,
    request: () => unauthorizedRequest("/agent-queue/dispositions"),
  },
  {
    name: "GET /rooms/:id/handoff",
    dispatch: dispatchHandoffRoutes,
    request: () => unauthorizedRequest("/rooms/room-1/handoff"),
  },
  {
    name: "GET /rooms (list)",
    dispatch: dispatchRoomsListExportRoutes,
    request: () => unauthorizedRequest("/rooms"),
  },
  {
    name: "GET /admin/reports",
    dispatch: dispatchAdminSearchAutomationRoutes,
    request: () => unauthorizedRequest("/admin/reports"),
  },
  {
    name: "GET /digest/preferences",
    dispatch: dispatchDigestRoutes,
    request: () => unauthorizedRequest("/digest/preferences"),
  },
  {
    name: "GET /activities",
    dispatch: dispatchActivitiesRoutes,
    request: () => unauthorizedRequest("/activities"),
  },
  {
    name: "GET /rooms/:id/presence",
    dispatch: dispatchPresenceRoutes,
    request: () => unauthorizedRequest("/rooms/room-1/presence"),
  },
  {
    name: "POST /rooms/:id/presence",
    dispatch: dispatchPresenceRoutes,
    request: () =>
      unauthorizedRequest("/rooms/room-1/presence", {
        method: "POST",
        body: { type: "cursor", payload: {} },
      }),
  },
  {
    name: "GET /push/devices",
    dispatch: dispatchPushRoutes,
    request: () => unauthorizedRequest("/push/devices"),
  },
  {
    name: "POST /push/devices",
    dispatch: dispatchPushRoutes,
    request: () =>
      unauthorizedRequest("/push/devices", {
        method: "POST",
        body: { platform: "web", token: "tok" },
      }),
  },
  {
    name: "POST /messages/voice",
    dispatch: dispatchVoiceMessagesRoutes,
    request: () => unauthorizedRequest("/messages/voice", { method: "POST", body: {} }),
  },
  {
    name: "POST /voice-ai/transcribe",
    dispatch: dispatchVoiceAiRoutes,
    request: () =>
      unauthorizedRequest("/voice-ai/transcribe", {
        method: "POST",
        body: { audioBase64: "YQ==" },
      }),
  },
  {
    name: "POST /voice-ai/speak",
    dispatch: dispatchVoiceAiRoutes,
    request: () =>
      unauthorizedRequest("/voice-ai/speak", { method: "POST", body: { text: "hi" } }),
  },
  {
    name: "GET /blocks",
    dispatch: dispatchUserBlocksRoutes,
    request: () => unauthorizedRequest("/blocks"),
  },
  {
    name: "GET /llm/providers",
    dispatch: dispatchLlmRoutes,
    request: () => unauthorizedRequest("/llm/providers"),
  },
  {
    name: "POST /api/devtools/chat",
    dispatch: dispatchDevtoolsRoutes,
    request: () => unauthorizedRequest("/api/devtools/chat", { method: "POST", body: { message: "hi" } }),
  },
  {
    name: "GET /api/threads/:id/state",
    dispatch: dispatchThreadStateRoutes,
    request: () => unauthorizedRequest("/api/threads/t1/state"),
  },
  {
    name: "POST /messages/:id/summary",
    dispatch: dispatchThreadSummaryRoutes,
    request: () => unauthorizedRequest("/messages/1/summary", { method: "POST", body: {} }),
  },
  {
    name: "POST /events",
    dispatch: dispatchEventsRoutes,
    request: () =>
      unauthorizedRequest("/events", {
        method: "POST",
        body: { roomIds: ["room-1"], name: "custom" },
      }),
  },
  {
    name: "POST /admin/scheduled/run",
    dispatch: dispatchScheduledAdminRoutes,
    request: () => unauthorizedRequest("/admin/scheduled/run", { method: "POST", body: {} }),
  },
  {
    name: "GET /rooms/:id/memory",
    dispatch: dispatchRoomMemoryRoutes,
    request: () => unauthorizedRequest("/rooms/room-1/memory"),
  },
  {
    name: "GET /admin/embed-config",
    dispatch: dispatchEmbedRoutes,
    request: () => unauthorizedRequest("/admin/embed-config"),
  },
];

describe("auth matrix — GA / hot routes return 401 without JWT", () => {
  for (const c of cases401) {
    it(`${c.name}`, async () => {
      const req = c.request();
      const res = await c.dispatch(req, new URL(req.url), createAuthMatrixDeps());
      expect(res, `${c.name} should match a handler`).not.toBeNull();
      expect(res.status, `${c.name} should be Unauthorized`).toBe(401);
    });
  }
});

describe("auth matrix — role denial", () => {
  it("GET /activities returns 403 for member without admin roles", async () => {
    const req = unauthorizedRequest("/activities");
    const res = await dispatchActivitiesRoutes(
      req,
      new URL(req.url),
      createAuthMatrixDeps({
        verifyJwt: async () => ({
          userId: "u1",
          projectId: "p1",
          roles: ["member"],
        }),
      }),
    );
    expect(res).not.toBeNull();
    expect(res.status).toBe(403);
  });

  it("GET /admin/reports returns 403 for member role", async () => {
    const req = unauthorizedRequest("/admin/reports");
    const res = await dispatchAdminSearchAutomationRoutes(
      req,
      new URL(req.url),
      createAuthMatrixDeps({
        verifyJwt: async () => ({
          userId: "u1",
          projectId: "p1",
          roles: ["member"],
        }),
      }),
    );
    expect(res).not.toBeNull();
    expect(res.status).toBe(403);
  });
});

