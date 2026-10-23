import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { defaultOpsPolicy, enableAllBuiltinTools } from "./ops-policy.js";
import { decideRunApproval, startOpsRun } from "./ops-engine.js";
import { lintOpsDefinition } from "./ops-lint.js";
import { executeOpsTool } from "./ops-sources.js";
import { installOpsTemplate, listOpsTemplates } from "./ops-templates.js";

describe("ops templates", () => {
  it("lists the built-in incident-response template", () => {
    const templates = listOpsTemplates();
    expect(templates.some((template) => template.slug === "incident-response")).toBe(true);
  });

  it("installs a published version and wires the incident workflow policy", async () => {
    const store = createMemoryOpsStore();
    const result = await installOpsTemplate(store, {
      projectId: "p1",
      slug: "incident-response",
      actor: "u1",
    });
    expect(result.ok).toBe(true);
    const published = await store.latestPublished("p1", "incident-response");
    expect(published).toBeTruthy();
    expect(published.status).toBe("published");
    expect(published.definition.steps.some((step) => step.type === "approval")).toBe(true);
    expect(published.definition.steps.some((step) => step.tool === "notify.send")).toBe(true);
    const policy = await store.getPolicy("p1");
    expect(policy.incidentWorkflowSlug).toBe("incident-response");
    const lint = lintOpsDefinition(published.definition, {
      tools: enableAllBuiltinTools(),
      policy: defaultOpsPolicy(),
    });
    expect(lint.ok).toBe(true);
  });

  it("installing again publishes the next version", async () => {
    const store = createMemoryOpsStore();
    await installOpsTemplate(store, { projectId: "p1", slug: "incident-response", actor: "u1" });
    await installOpsTemplate(store, { projectId: "p1", slug: "incident-response", actor: "u1" });
    const published = await store.latestPublished("p1", "incident-response");
    expect(published.version).toBe(2);
  });

  it("rejects unknown templates", async () => {
    const store = createMemoryOpsStore();
    const result = await installOpsTemplate(store, { projectId: "p1", slug: "nope", actor: "u1" });
    expect(result).toMatchObject({ ok: false, error: "template_not_found" });
  });

  it("runs end to end: gather evidence, owner approves, room gets notified", async () => {
    const store = createMemoryOpsStore();
    await store.putFile("p1", {
      sourceId: "files",
      key: "runbook-pooler.txt",
      text: "Restart the pooler when connections saturate.",
      contentType: "text/plain",
    });
    for (const tool of enableAllBuiltinTools()) await store.upsertTool("p1", tool);
    await installOpsTemplate(store, { projectId: "p1", slug: "incident-response", actor: "u1" });
    const published = await store.latestPublished("p1", "incident-response");

    const inserts = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                first: async () => null,
                run: async () => {
                  inserts.push(sql);
                  return { meta: { changes: 1, last_row_id: inserts.length } };
                },
                all: async () => ({ results: sql.includes("room_members") ? [{ user_id: "u2" }] : [] }),
              };
            },
          };
        },
      },
    };
    const calls = [];
    const executeTool = (name, input, extra) => {
      calls.push(name);
      return executeOpsTool(store, defaultOpsPolicy(), env, name, input, { ...extra, projectId: "p1" });
    };

    const run = await startOpsRun(store, {
      env,
      projectId: "p1",
      version: published,
      trigger: { type: "webhook", source: "incident" },
      actor: "integration:pagerduty",
      roomId: "r1",
      context: { toolInputs: { "files.search": { query: "pooler" } } },
      executeTool,
    });
    expect(run.status).toBe("waiting");
    expect(calls).toContain("files.search");
    expect(calls).toContain("incidents.read");

    const approval = await store.getApproval("p1", run.context.approvalId);
    const decided = await decideRunApproval(store, {
      projectId: "p1",
      approvalId: approval.id,
      actor: "u1",
      decision: "approve",
      payloadHash: approval.payloadHash,
      executeTool,
    });
    expect(calls).toContain("notify.send");
    expect(decided.run.status).toBe("done");
    expect(inserts.some((sql) => sql.includes("in_app_notifications"))).toBe(true);
  });
});
