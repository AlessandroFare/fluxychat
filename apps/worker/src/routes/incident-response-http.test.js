import { describe, expect, it } from "vitest";
import { dispatchIncidentRoutes } from "./incident-response-http.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";

const incidentRow = {
  id: "i1",
  project_id: "p1",
  room_id: "r1",
  title: "DB down",
  description: "postgres unreachable",
  severity: "sev2",
  status: "resolved",
  service: "postgres",
  environment: "prod",
  alert_source: "pagerduty",
  alert_id: "PD1",
  started_at: "2026-10-17T10:00:00.000Z",
  acknowledged_at: "2026-10-17T10:05:00.000Z",
  resolved_at: "2026-10-17T10:30:00.000Z",
  mttr_seconds: 1800,
  root_cause: "connection pool exhaustion",
  postmortem: "Blameless: pool sizing was changed during the release.",
  action_items: "[]",
  timeline: "[]",
  created_at: "2026-10-17T10:00:00.000Z",
};

const timelineRows = [
  {
    id: "u1",
    incident_id: "i1",
    project_id: "p1",
    user_id: "integration:pagerduty",
    update_type: "alert",
    content: "incident.triggered: DB down",
    metadata: "{}",
    created_at: "2026-10-17T10:00:05.000Z",
  },
];

function makeEnv(store) {
  return {
    OPS_STORE: store,
    DB: {
      prepare(sql) {
        return {
          bind() {
            return {
              first: async () => (sql.includes("FROM incidents") ? incidentRow : null),
              all: async () => ({ results: sql.includes("FROM incident_updates") ? timelineRows : [] }),
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

function h(env) {
  return {
    env,
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["admin"] }),
    logError: () => {},
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
  };
}

async function call(env, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchIncidentRoutes(request, new URL(request.url), h(env));
}

describe("incident knowledge hooks", () => {
  it("writes a knowledge report when an incident is resolved", async () => {
    const store = createMemoryOpsStore();
    const res = await call(makeEnv(store), "PATCH", "/incidents/i1", { status: "resolved" });
    expect(res.status).toBe(200);
    const files = await store.listFiles("p1", "incidents");
    expect(files).toHaveLength(1);
    expect(files[0].key).toBe("incident-i1.md");
    expect(files[0].text).toContain("## Postmortem");
    expect(files[0].text).toContain("incident.triggered: DB down");
  });

  it("refreshes the same report when the postmortem is saved", async () => {
    const store = createMemoryOpsStore();
    const res = await call(makeEnv(store), "POST", "/incidents/i1/postmortem", {
      postmortem: "Blameless: pool sizing was changed during the release.",
    });
    expect(res.status).toBe(200);
    const files = await store.listFiles("p1", "incidents");
    expect(files).toHaveLength(1);
    expect(files[0].text).toContain("Blameless: pool sizing was changed during the release.");
  });

  it("does not touch knowledge for unrelated status changes", async () => {
    const store = createMemoryOpsStore();
    const env = makeEnv(store);
    env.DB.prepare = (sql) => ({
      bind: () => ({
        first: async () => (sql.includes("FROM incidents") ? { ...incidentRow, status: "monitoring" } : null),
        all: async () => ({ results: [] }),
        run: async () => ({ meta: { changes: 1 } }),
      }),
    });
    const res = await call(env, "PATCH", "/incidents/i1", { status: "monitoring" });
    expect(res.status).toBe(200);
    expect(await store.listFiles("p1", "incidents")).toHaveLength(0);
  });
});
