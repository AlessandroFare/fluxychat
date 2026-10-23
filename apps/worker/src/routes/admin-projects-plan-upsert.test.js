import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { PROJECT_PLAN_UPSERT_SQL } from "./admin-projects-http.js";

// Canonical schema: db/baseline/0136_schema.sql:2473 (+ 0019, 0022, 0030).
const SCHEMA = `
CREATE TABLE project_plans (
  project_id TEXT PRIMARY KEY,
  plan_name TEXT NOT NULL DEFAULT 'free',
  billing_status TEXT NOT NULL DEFAULT 'manual',
  message_limit_monthly INTEGER,
  agent_invoke_limit_monthly INTEGER,
  webhook_delivery_limit_monthly INTEGER,
  pricing_version TEXT NOT NULL DEFAULT 'v1',
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  manually_overridden INTEGER NOT NULL DEFAULT 0
);`;

function newDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  return db;
}

// Same statement + bind order the admin route uses.
function applyPlanChange(db, { projectId, planName, billingStatus = null, now = "2026-10-18T12:00:00.000Z" }) {
  db.prepare(PROJECT_PLAN_UPSERT_SQL).run(
    projectId,
    planName,
    billingStatus,
    5000000,
    5000,
    50000,
    "v1",
    now,
    projectId,
    now,
    billingStatus,
  );
}

function seedPaidRow(db) {
  db.prepare(
    "INSERT INTO project_plans (project_id, plan_name, billing_status, stripe_customer_id, stripe_subscription_id, message_limit_monthly, agent_invoke_limit_monthly, webhook_delivery_limit_monthly, pricing_version, updated_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
  ).run("p1", "free", "active", "cus_abc", "sub_abc", 100, 10, 10, "v1", "2026-01-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z");
}

describe("admin plan upsert (PROJECT_PLAN_UPSERT_SQL)", () => {
  it("keeps Stripe linkage, billing status and created_at when an operator changes the plan", () => {
    const db = newDb();
    seedPaidRow(db);
    applyPlanChange(db, { projectId: "p1", planName: "pro" });
    const row = db.prepare("SELECT * FROM project_plans WHERE project_id = ?").get("p1");
    expect(row.plan_name).toBe("pro");
    expect(row.stripe_customer_id).toBe("cus_abc");
    expect(row.stripe_subscription_id).toBe("sub_abc");
    expect(row.billing_status).toBe("active");
    expect(row.created_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("inserts a fresh row with billing_status manual when no override is given", () => {
    const db = newDb();
    applyPlanChange(db, { projectId: "p2", planName: "pro" });
    const row = db.prepare("SELECT * FROM project_plans WHERE project_id = ?").get("p2");
    expect(row.plan_name).toBe("pro");
    expect(row.billing_status).toBe("manual");
    expect(row.created_at).toBe("2026-10-18T12:00:00.000Z");
  });

  it("lets an explicit billing status win on both paths", () => {
    const db = newDb();
    applyPlanChange(db, { projectId: "p3", planName: "pro", billingStatus: "comped" });
    applyPlanChange(db, { projectId: "p3", planName: "free", billingStatus: "active" });
    const row = db.prepare("SELECT * FROM project_plans WHERE project_id = ?").get("p3");
    expect(row.billing_status).toBe("active");
  });
});
