/**
 * Workspace (project) FluxyOps policy. Immutable for Builder and run agents.
 * Pattern from Onyx MIT community: implied permissions at read time, deny is audited.
 * Writes default-deny unless an admin enabled the tool.
 *
 * The catalog is domain-agnostic. Invoice, PTO, incidents, onboarding, etc. are
 * definitions the Builder writes — never special-cased in the engine.
 */
import { normalizeGuardrails } from "./ops-guardrails.js";
import { normalizeAdaptiveGates } from "./ops-adaptive-gates.js";

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

export const OPS_GUEST_CAN = ["upload_file", "comment", "approve"];

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
    name: "incidents.read",
    description: "Read a tracked incident and its recent timeline (defaults to the incident that started this run)",
    side: "read",
    risk: "low",
    requiresApproval: false,
    dataClasses: ["incident"],
    inputSchema: {
      type: "object",
      properties: {
        incidentId: { type: "string" },
        limit: { type: "number" },
      },
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
    description: "Call a tool on a registered MCP server (server and tool must be allow-listed)",
    side: "write",
    risk: "high",
    requiresApproval: true,
    dataClasses: ["external"],
    inputSchema: {
      type: "object",
      properties: {
        server: { type: "string" },
        tool: { type: "string" },
        arguments: { type: "object" },
      },
      required: ["server", "tool"],
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
    // C5: per-tool windowed quotas, evaluated at the gateway before execution.
    toolQuotas: [],
    // C7: tool → who may call it ("user:<id>" / "role:<role>"); empty = allowlist decides.
    toolAcls: [],
    // C6/I6: tools whose output stays hash-only in the console and the audit.
    confidentialTools: [],
    // Wren-style lookup notes: admin free text folded into the lookup step
    // instruction (bounded); never a free-SQL escape hatch.
    lookupNotes: null,
    // C4: optional pre/post pattern guardrails on MCP calls (off by default).
    guardrails: { enabled: false, block: [], redact: [] },
    // I2: behavioral gates on statically-allowed tools (off by default).
    adaptiveGates: { enabled: false, firstUse: false, offHours: null, spike: null, approveRoles: ["owner"] },
    // Incident events (integration kit webhooks) start this published
    // workflow in the linked incident room. null = incidents are tracked only.
    incidentWorkflowSlug: null,
    // Per-phase overrides for the incident lifecycle; "created" falls back to
    // incidentWorkflowSlug when the map is empty.
    incidentWorkflowSlugs: { created: null, acknowledged: null, resolved: null },
  };
}

function normalizeWorkflowSlug(value) {
  const slug = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 64);
  return slug || null;
}

function normalizeWorkflowSlugs(value) {
  const raw = value && typeof value === "object" ? value : {};
  return {
    created: normalizeWorkflowSlug(raw.created),
    acknowledged: normalizeWorkflowSlug(raw.acknowledged),
    resolved: normalizeWorkflowSlug(raw.resolved),
  };
}

/** The workflow slug an incident phase should start, legacy knob included. */
export function incidentWorkflowSlugFor(policy, action) {
  const byPhase = policy?.incidentWorkflowSlugs || {};
  return byPhase[action] || (action === "created" ? policy?.incidentWorkflowSlug || null : null);
}

export const OPS_TOOL_QUOTA_MAX = 10_000;
export const OPS_TOOL_QUOTA_WINDOW_MINUTES_MAX = 7 * 24 * 60;

/**
 * C5: `[{ tool, max, windowMinutes }]` — a call that would exceed `max` in the
 * rolling window is denied. Bad entries are dropped, not silently clamped to 0.
 */
export function normalizeToolQuotas(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 50)) {
    const tool = String(item?.tool || "").trim().slice(0, 128);
    const max = Math.floor(Number(item?.max));
    const windowMinutes = Math.floor(Number(item?.windowMinutes));
    if (!tool || !Number.isFinite(max) || max < 1) continue;
    if (!Number.isFinite(windowMinutes) || windowMinutes < 1) continue;
    out.push({
      tool,
      max: Math.min(max, OPS_TOOL_QUOTA_MAX),
      windowMinutes: Math.min(windowMinutes, OPS_TOOL_QUOTA_WINDOW_MINUTES_MAX),
    });
  }
  return out;
}

export const OPS_TOOL_ACL_MAX_SELECTORS = 50;

/**
 * C7: `[{ tool, allow: ["user:<id>", "role:<role>"] }]`. When an entry exists
 * for a tool, only the listed users/roles may call it — the project allowlist
 * is no longer enough. Entries that could never match are dropped.
 */
export function normalizeToolAcls(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 50)) {
    const tool = String(item?.tool || "").trim().slice(0, 128);
    const allow = Array.isArray(item?.allow)
      ? item.allow
          .map((selector) => String(selector || "").trim())
          .filter((selector) => /^(user|role):[^\s:]+$/.test(selector))
          .slice(0, OPS_TOOL_ACL_MAX_SELECTORS)
      : [];
    if (!tool || !allow.length) continue;
    out.push({ tool, allow });
  }
  return out;
}

/** C6/I6: tool names whose result is stored as a hash, never as the payload. */
export function normalizeConfidentialTools(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw.slice(0, 50)) {
    const tool = String(item || "").trim().slice(0, 128);
    if (tool && !out.includes(tool)) out.push(tool);
  }
  return out;
}

export const OPS_LOOKUP_NOTES_MAX = 4000;

/** Wren-style lookup notes: trimmed, 4KB cap, null when empty. */
export function normalizeLookupNotes(value) {
  const notes = String(value || "").trim();
  return notes ? notes.slice(0, OPS_LOOKUP_NOTES_MAX) : null;
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
    toolQuotas: normalizeToolQuotas(raw.toolQuotas),
    guardrails: normalizeGuardrails(raw.guardrails),
    adaptiveGates: normalizeAdaptiveGates(raw.adaptiveGates),
    toolAcls: normalizeToolAcls(raw.toolAcls),
    confidentialTools: normalizeConfidentialTools(raw.confidentialTools),
    lookupNotes: normalizeLookupNotes(raw.lookupNotes),
    highRiskQuorum: Number(raw.highRiskQuorum) >= 1 ? Number(raw.highRiskQuorum) : base.highRiskQuorum,
    incidentWorkflowSlug: normalizeWorkflowSlug(raw.incidentWorkflowSlug),
    incidentWorkflowSlugs: normalizeWorkflowSlugs(raw.incidentWorkflowSlugs),
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
