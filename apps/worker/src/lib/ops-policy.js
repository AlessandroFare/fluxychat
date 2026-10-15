/**
 * Workspace (project) FluxyOps policy. Immutable for Builder and run agents.
 * Pattern from Onyx MIT community: implied permissions at read time, deny is audited.
 * Writes default-deny unless an admin enabled the tool.
 *
 * The catalog is domain-agnostic. Invoice, PTO, incidents, onboarding, etc. are
 * definitions the Builder writes — never special-cased in the engine.
 */

export const OPS_STEP_TYPES = [
  "human_task",
  "agent_task",
  "approval",
  "wait_for_guest",
  "tool_call",
  "branch",
  "notify",
  "end",
];

export const OPS_GUEST_CAN = ["upload_file", "comment"];

export const OPS_NAMED_VIEWS = [
  {
    name: "orders",
    description: "Purchase orders / goods received",
    columns: ["id", "invoiceNumber", "supplier", "total", "status"],
    joins: [{ to: "crm_accounts", on: "supplier" }],
    synonyms: ["purchase order", "PO", "goods received"],
  },
  {
    name: "employees",
    description: "Employee directory (read-only)",
    columns: ["id", "email", "role", "managerId", "status"],
    joins: [],
    synonyms: ["staff", "directory", "HR"],
  },
  {
    name: "tickets",
    description: "Support or incident tickets",
    columns: ["id", "severity", "owner", "status", "roomId"],
    joins: [{ to: "employees", on: "owner" }],
    synonyms: ["incident", "case", "P1"],
  },
  {
    name: "inventory",
    description: "Stock levels",
    columns: ["id", "sku", "quantity", "location"],
    joins: [],
    synonyms: ["stock", "warehouse"],
  },
  {
    name: "crm_accounts",
    description: "Customer / supplier accounts",
    columns: ["id", "name", "domain", "kind"],
    joins: [],
    synonyms: ["customer", "supplier", "account"],
  },
];

export function namedViewByName(name) {
  return OPS_NAMED_VIEWS.find((view) => view.name === name) || null;
}

export function catalogNamedViews(policy) {
  const allowed = policy?.allowedViews || OPS_NAMED_VIEWS.map((view) => view.name);
  return OPS_NAMED_VIEWS.filter((view) => allowed.includes(view.name));
}

/** Built-in tools every workspace can enable. Admins may add MCP tools on top. */
export const DEFAULT_OPS_TOOL_REGISTRY = [
  {
    name: "files.search",
    description: "Search indexed workspace files (AI Search or Vectorize)",
    side: "read",
    risk: "low",
    requiresApproval: false,
    dataClasses: ["document"],
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "files.read",
    description: "Read a workspace file by id",
    side: "read",
    risk: "low",
    requiresApproval: false,
    dataClasses: ["document"],
    inputSchema: { type: "object", properties: { fileId: { type: "string" } }, required: ["fileId"] },
  },
  {
    name: "ocr.read",
    description: "Extract text from an uploaded document or image",
    side: "read",
    risk: "low",
    requiresApproval: false,
    dataClasses: ["document"],
    inputSchema: { type: "object", properties: { fileId: { type: "string" } }, required: ["fileId"] },
  },
  {
    name: "db.query_named_view",
    description: "Query an admin-allowlisted named view. No free SQL.",
    side: "read",
    risk: "low",
    requiresApproval: false,
    dataClasses: ["database"],
    inputSchema: {
      type: "object",
      properties: {
        view: { type: "string" },
        filters: { type: "object" },
      },
      required: ["view"],
    },
  },
  {
    name: "notify.send",
    description: "Notify a role or user inside the workspace",
    side: "write",
    risk: "medium",
    requiresApproval: true,
    dataClasses: ["message"],
    inputSchema: {
      type: "object",
      properties: {
        role: { type: "string" },
        userId: { type: "string" },
        message: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "mcp.call",
    description: "Call an enabled MCP tool by name (payload checked by the gateway)",
    side: "write",
    risk: "high",
    requiresApproval: true,
    dataClasses: ["external"],
    inputSchema: {
      type: "object",
      properties: {
        tool: { type: "string" },
        arguments: { type: "object" },
      },
      required: ["tool"],
    },
  },
  {
    name: "erp.register_payment",
    description: "Register a payment in the connected ERP (enable per workspace)",
    side: "write",
    risk: "high",
    requiresApproval: true,
    dataClasses: ["payment"],
    inputSchema: {
      type: "object",
      properties: {
        invoiceNumber: { type: "string" },
        total: { type: "number" },
      },
      required: ["invoiceNumber", "total"],
    },
  },
];

export const BUILDER_TOOL_NAMES = [
  "list_sources",
  "inspect_source",
  "list_tools",
  "draft_definition",
  "validate_definition",
  "simulate_run",
  "explain_definition",
  "diff_versions",
  "request_publish",
];

export function defaultOpsPolicy() {
  return {
    version: 1,
    defaultWriteEffect: "deny",
    highRiskQuorum: 2,
    amountQuorum: {
      if: { ">": [{ var: "total" }, 5000] },
      require: 2,
    },
    guestDomains: [],
    forbiddenActions: ["outbound_email_unknown_domain"],
    budgets: {
      maxToolCallsPerRun: 40,
      maxTokensPerRun: 200000,
    },
    allowedSources: ["files", "named_views", "mcp"],
    allowedViews: OPS_NAMED_VIEWS.map((view) => view.name),
  };
}

export function normalizeOpsPolicy(raw) {
  const base = defaultOpsPolicy();
  if (!raw || typeof raw !== "object") return base;
  return {
    ...base,
    ...raw,
    budgets: { ...base.budgets, ...(raw.budgets || {}) },
    guestDomains: Array.isArray(raw.guestDomains) ? raw.guestDomains.map(String) : base.guestDomains,
    forbiddenActions: Array.isArray(raw.forbiddenActions)
      ? raw.forbiddenActions.map(String)
      : base.forbiddenActions,
    allowedViews: Array.isArray(raw.allowedViews) ? raw.allowedViews.map(String) : base.allowedViews,
    highRiskQuorum: Number(raw.highRiskQuorum) >= 1 ? Number(raw.highRiskQuorum) : base.highRiskQuorum,
  };
}

export function registryByName(tools) {
  const map = new Map();
  for (const tool of tools || []) map.set(tool.name, tool);
  return map;
}

export function mergeProjectTools(enabledRows) {
  const byName = registryByName(DEFAULT_OPS_TOOL_REGISTRY);
  for (const row of enabledRows || []) {
    const base = byName.get(row.name) || {
      name: row.name,
      description: row.description || "",
      side: row.side || "read",
      risk: row.risk || "low",
      requiresApproval: Boolean(row.requiresApproval),
      dataClasses: Array.isArray(row.dataClasses) ? row.dataClasses : [],
      inputSchema: row.inputSchema || {},
    };
    byName.set(row.name, {
      ...base,
      enabled: row.enabled !== 0 && row.enabled !== false,
      requiresApproval: Boolean(row.requiresApproval ?? base.requiresApproval),
      side: row.side || base.side,
      risk: row.risk || base.risk,
    });
  }
  return [...byName.values()].map((tool) => ({
    ...tool,
    enabled: tool.enabled === true,
  }));
}

export function assertToolAllowed(tool, { publishedAllowlist } = {}) {
  if (!tool || tool.enabled !== true) {
    return { ok: false, error: "tool_not_enabled" };
  }
  if (publishedAllowlist && !publishedAllowlist.includes(tool.name)) {
    return { ok: false, error: "tool_not_in_definition" };
  }
  return { ok: true };
}

export function impliedCanRead(side) {
  return side === "read" || side === "write";
}

export function enableAllBuiltinTools() {
  return DEFAULT_OPS_TOOL_REGISTRY.map((tool) => ({ ...tool, enabled: true }));
}
