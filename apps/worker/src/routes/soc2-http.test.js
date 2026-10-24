import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dispatchSOC2Routes } from "./soc2-http.js";
import { defaultOpsPolicy } from "../lib/ops-policy.js";
import { createMemoryOpsStore } from "../lib/ops-store.js";

/** The report_type VALUES allowed by migration 0129 — inserts must stay inside it. */
function allowedReportTypes() {
  const sql = readFileSync(new URL("../../db/0129_soc2_compliance.sql", import.meta.url), "utf8");
  const match = sql.match(/report_type\s+TEXT NOT NULL CHECK \(report_type IN \(([^)]+)\)\)/);
  return (match?.[1] || "").split(",").map((value) => value.trim().replace(/^'|'$/g, ""));
}

function makeEnv(store) {
  const sqlLog = [];
  const calls = [];
  const env = {
    OPS_STORE: store,
    DB: {
      prepare(sql) {
        sqlLog.push(sql);
        return {
          bind(...args) {
            calls.push({ sql, args });
            return {
              async first() {
                if (sql.includes("avg_mttr")) return { avg_mttr: null, avg_mtta: null };
                if (sql.includes("COUNT(*)")) return { total: 0 };
                return null;
              },
              async all() {
                return { results: [] };
              },
              async run() {
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
  return { env, sqlLog, calls };
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
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["owner"] }),
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
  };
}

async function post(env, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  return dispatchSOC2Routes(request, new URL(request.url), h(env));
}

describe("soc2 evidence pack route", () => {
  it("generates an evidence pack from live ops data and stores it as a report", async () => {
    const store = createMemoryOpsStore();
    await store.putPolicy("p1", { ...defaultOpsPolicy(), incidentWorkflowSlug: "incident-response" }, "admin");
    await store.createRun({ projectId: "p1", roomId: "r1", versionId: "v1", status: "done", cost: { toolCalls: 3, tokens: 50 } });
    const { env, sqlLog, calls } = makeEnv(store);

    const res = await post(env, "/api/soc2/reports/evidence", { days: 30 });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.report.id).toMatch(/^srpt_/);
    expect(data.document).toContain("# Operations evidence pack");
    expect(data.document).toContain("Incident workflow: incident-response");
    expect(data.document).toContain("Runs in period: 1 (done: 1)");
    expect(data.evidence.periodDays).toBe(30);
    expect(sqlLog.some((sql) => sql.includes("INSERT INTO soc2_reports"))).toBe(true);
    // Guards against migration drift: an unknown report_type fails the CHECK in D1.
    const insert = calls.find((call) => call.sql.includes("INSERT INTO soc2_reports"));
    expect(allowedReportTypes()).toContain(insert.args[2]);
  });

  it("still routes other soc2 paths when the evidence path is present", async () => {
    const { env } = makeEnv(createMemoryOpsStore());
    const request = new Request("https://worker.test/api/soc2/dashboard", { method: "GET" });
    const res = await dispatchSOC2Routes(request, new URL(request.url), h(env));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ controls: [] });
  });
});
