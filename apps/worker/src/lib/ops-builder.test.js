import { describe, expect, it } from "vitest";
import { createMemoryOpsStore } from "./ops-store.js";
import { enableAllBuiltinTools, defaultOpsPolicy, normalizeLookupNotes, OPS_LOOKUP_NOTES_MAX } from "./ops-policy.js";
import { draftDefinitionFromRequest, handleBuilderChat, invokeBuilderTool, pickMcpCall } from "./ops-builder.js";

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

  it("starts incident requests with a read of the tracked incident", () => {
    const result = draftDefinitionFromRequest({
      text: "P1 incident: on-call reviews, commander approves the comms, then notify engineering.",
      tools,
      sources,
      policy,
    });
    expect(result.ok).toBe(true);
    const triage = result.definition.steps.find((s) => s.id === "triage");
    expect(triage?.type).toBe("agent_task");
    expect(triage?.tools).toEqual(["incidents.read"]);

    const withoutIncidentTool = draftDefinitionFromRequest({
      text: "P1 incident: on-call reviews, commander approves the comms, then notify engineering.",
      tools: tools.filter((t) => t.name !== "incidents.read").map((t) => ({ ...t, enabled: true })),
      sources,
      policy,
    });
    expect(withoutIncidentTool.definition.steps.some((s) => s.id === "triage")).toBe(false);
  });

  it("matches a named view by synonym and describes it in the lookup instruction", () => {
    const result = draftDefinitionFromRequest({
      text: "Lookup the warehouse stock before ordering.",
      tools,
      sources,
      policy,
    });
    expect(result.ok).toBe(true);
    const lookup = result.definition.steps.find((s) => s.id === "lookup");
    // "stock"/"warehouse" pick inventory, not the first allowlisted view (orders).
    expect(lookup?.tools).toEqual(["db.query_named_view"]);
    expect(lookup?.instruction).toContain("named view inventory (Stock levels)");
    expect(lookup?.instruction).toContain("Synonyms: stock, warehouse");
  });

  it("folds admin lookup notes into the lookup instruction", () => {
    const result = draftDefinitionFromRequest({
      text: "Lookup the warehouse stock before ordering.",
      tools,
      sources,
      policy: { ...policy, lookupNotes: "Stock is per warehouse, not per project." },
    });
    const lookup = result.definition.steps.find((s) => s.id === "lookup");
    expect(lookup?.instruction).toContain(
      "Workspace lookup notes: Stock is per warehouse, not per project.",
    );
    // The notes ride the lookup step only: no lookup step, no notes text.
    const withoutLookup = draftDefinitionFromRequest({
      text: "PTO request for next week.",
      tools,
      sources,
      policy: { ...policy, lookupNotes: "unused" },
    });
    expect(withoutLookup.definition.steps.some((s) => s.id === "lookup")).toBe(false);
  });

  it("caps lookup notes at OPS_LOOKUP_NOTES_MAX and drops blank notes", () => {
    expect(normalizeLookupNotes("  padded  ")).toBe("padded");
    expect(normalizeLookupNotes("   ")).toBeNull();
    expect(normalizeLookupNotes("x".repeat(OPS_LOOKUP_NOTES_MAX + 100))).toHaveLength(
      OPS_LOOKUP_NOTES_MAX,
    );
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

  it("picks the registered MCP server and tool, or asks when none fits", () => {
    const iam = { name: "iam", enabled: true, allowedTools: ["revoke_session", "list_users"] };
    expect(pickMcpCall("Suspicious login: two-person approval, MCP to revoke the session.", [iam])).toEqual({
      server: "iam",
      tool: "revoke_session",
    });
    // Server named in the text with a single allowed tool.
    expect(pickMcpCall("File it via the IAM server.", [{ name: "iam", enabled: true, allowedTools: ["grant_role"] }])).toEqual({
      server: "iam",
      tool: "grant_role",
    });
    // Ambiguous registry, no keyword and no named server: no guess.
    expect(
      pickMcpCall("Do the external thing.", [
        { name: "iam", enabled: true, allowedTools: ["revoke_session", "list_users"] },
        { name: "erp", enabled: true, allowedTools: ["create_purchase"] },
      ]),
    ).toBeNull();
    // A disabled server is not callable.
    expect(pickMcpCall("revoke the session", [{ name: "iam", enabled: false, allowedTools: ["revoke_session"] }])).toBeNull();

    const drafted = draftDefinitionFromRequest({
      text: "Suspicious login: security reviews, two-person approval, then MCP to revoke the session.",
      tools,
      sources,
      policy,
      mcpServers: [iam],
    });
    const write = drafted.definition.steps.find((step) => step.id === "write");
    expect(write).toMatchObject({ tool: "mcp.call", input: { server: "iam", tool: "revoke_session" } });

    const bare = draftDefinitionFromRequest({
      text: "Suspicious login: security reviews, two-person approval, then MCP to revoke the session.",
      tools,
      sources,
      policy,
    });
    const bareWrite = bare.definition.steps.find((step) => step.id === "write");
    expect(bareWrite.input).toEqual({});
    expect(bare.questions.join(" ")).toMatch(/which mcp server/i);
    expect(bare.lint.warnings.some((warning) => warning.code === "tool_input_missing")).toBe(true);
  });

  it("feeds the registry to the builder without leaking secrets", async () => {
    const store = createMemoryOpsStore();
    const projectId = "p1";
    for (const tool of tools) await store.upsertTool(projectId, tool);
    await store.putPolicy(projectId, policy, "admin");
    await store.upsertMcpServer(projectId, {
      name: "iam",
      url: "https://mcp.example.com/mcp",
      enabled: true,
      allowedTools: ["revoke_session"],
      secretCiphertext: "ciphertext",
      secretIv: "iv",
    });

    const sourcesList = await invokeBuilderTool(store, { projectId, actor: "u1", name: "list_sources", input: {} });
    expect(sourcesList.mcpServers).toEqual([{ name: "iam", enabled: true, allowedTools: ["revoke_session"] }]);

    const drafted = await invokeBuilderTool(store, {
      projectId,
      actor: "u1",
      name: "draft_definition",
      input: { text: "Suspicious login: security reviews, two-person approval, then MCP to revoke the session." },
    });
    const write = drafted.definition.steps.find((step) => step.id === "write");
    expect(write).toMatchObject({ tool: "mcp.call", input: { server: "iam", tool: "revoke_session" } });
    expect(JSON.stringify(drafted)).not.toContain("ciphertext");
  });
});
