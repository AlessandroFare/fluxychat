import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { enableAllBuiltinTools, defaultOpsPolicy } from "./ops-policy.js";
import { draftDefinitionFromRequest, handleBuilderChat, invokeBuilderTool } from "./ops-builder.js";

describe("ops-builder", () => {
  const tools = enableAllBuiltinTools();
  const sources = [{ id: "files" }, { id: "named_views" }];
  const policy = defaultOpsPolicy();

  it("drafts unrelated workplace processes without inventing tools", () => {
    const pto = draftDefinitionFromRequest({
      text: "When an employee submits PTO, ask their manager to approve and notify HR.",
      tools,
      sources,
      policy,
    });
    expect(pto.ok).toBe(true);
    expect(pto.definition.steps.some((s) => s.type === "human_task")).toBe(true);
    const access = draftDefinitionFromRequest({
      text: "Access request to production: security reviews, two-person approval, then MCP call to the IAM tool.",
      tools,
      sources,
      policy,
    });
    expect(access.definition.steps.some((s) => s.tool === "mcp.call" || s.tools?.includes("mcp.call"))).toBe(true);
  });

  it("refuses to invent a tool that is not connected", () => {
    const result = draftDefinitionFromRequest({
      text: "Please launch the nuclear payroll zapper and wire funds to mars.",
      tools: tools.filter((t) => t.side === "read").map((t) => ({ ...t, enabled: true })),
      sources,
      policy,
    });
    expect(result.ok).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("cannot publish as a builder tool", async () => {
    const store = createMemoryOpsStore();
    const projectId = "p1";
    for (const tool of tools) await store.upsertTool(projectId, tool);
    await store.putPolicy(projectId, policy, "admin");
    const pub = await invokeBuilderTool(store, { projectId, actor: "bot", name: "publish", input: {} });
    expect(pub.ok).toBe(false);
    const chat = await handleBuilderChat(store, {
      projectId,
      actor: "u1",
      text: "Onboarding: IT provisions after security approves, then notify the manager.",
    });
    expect(chat.drafted.lint.ok).toBe(true);
    expect(chat.panel.summary).toBeTruthy();
  });
});
