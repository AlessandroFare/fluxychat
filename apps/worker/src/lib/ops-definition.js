import { OPS_GUEST_CAN, OPS_STEP_TYPES } from "./ops-policy.js";
import { isJsonLogicRule } from "./ops-jsonlogic.js";

const MAX_STEPS = 40;
const MAX_ID = 64;

function asId(value, fallback) {
  const id = String(value || fallback || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "_")
    .slice(0, MAX_ID);
  return id || fallback || "step";
}

function normalizeNext(next) {
  if (next == null) return "end";
  if (typeof next === "string") return asId(next, "end");
  if (Array.isArray(next)) {
    return next.map((branch) => {
      if (typeof branch === "string") return { to: asId(branch, "end") };
      const when = branch?.when === "else" || branch?.else ? "else" : branch?.when;
      if (when !== "else" && when != null && typeof when === "object" && !isJsonLogicRule(when)) {
        throw new Error("branch_when_must_be_jsonlogic");
      }
      return {
        when,
        to: asId(branch?.to, "end"),
      };
    });
  }
  if (typeof next === "object" && next.to) return [{ when: next.when, to: asId(next.to, "end") }];
  return "end";
}

function normalizeTimeout(raw) {
  if (!raw || typeof raw !== "object") return { afterMs: 86_400_000, onTimeout: "fail" };
  const afterMs = Number(raw.afterMs || raw.ms);
  const after = raw.after;
  let ms = afterMs;
  if (!Number.isFinite(ms) && typeof after === "string") {
    const match = after.match(/^(\d+)(ms|s|m|h|d)$/);
    if (match) {
      const n = Number(match[1]);
      const unit = match[2];
      ms = unit === "ms" ? n : unit === "s" ? n * 1000 : unit === "m" ? n * 60_000 : unit === "h" ? n * 3_600_000 : n * 86_400_000;
    }
  }
  if (!Number.isFinite(ms) || ms <= 0) ms = 86_400_000;
  return { afterMs: ms, onTimeout: raw.onTimeout === "escalate" || raw.onTimeout === "skip" ? raw.onTimeout : "fail" };
}

function normalizeStep(raw, index) {
  const type = String(raw?.type || "");
  if (!OPS_STEP_TYPES.includes(type)) {
    throw new Error(`unknown_step_type:${type || "missing"}`);
  }
  const id = asId(raw.id, `step_${index + 1}`);
  const step = {
    id,
    type,
    timeout: normalizeTimeout(raw.timeout || raw.due),
    next: type === "end" ? null : normalizeNext(raw.next),
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String).slice(0, 20) : [],
  };
  if (type === "agent_task") {
    step.instruction = String(raw.instruction || "").slice(0, 4000);
    step.tools = Array.isArray(raw.tools) ? raw.tools.map(String).slice(0, 20) : [];
    step.budget = {
      maxToolCalls: Math.min(Number(raw.budget?.max_tool_calls || raw.budget?.maxToolCalls) || 8, 40),
      maxTokens: Math.min(Number(raw.budget?.max_tokens || raw.budget?.maxTokens) || 20_000, 200_000),
    };
    if (step.tools.includes("files.search")) step.cite = raw.cite !== false;
  }
  if (type === "human_task") {
    step.assignee = raw.assignee && typeof raw.assignee === "object" ? raw.assignee : { role: String(raw.assignee || "owner") };
  }
  if (type === "approval") {
    step.roles = Array.isArray(raw.roles) ? raw.roles.map(String) : ["owner"];
    step.quorum = raw.quorum && typeof raw.quorum === "object" ? raw.quorum : { default: Number(raw.quorum) || 1 };
  }
  if (type === "wait_for_guest") {
    const can = Array.isArray(raw.guest?.can) ? raw.guest.can.map(String) : ["comment"];
    step.guest = {
      emailFrom: raw.guest?.email_from || raw.guest?.emailFrom || "guest_email",
      can: can.filter((item) => OPS_GUEST_CAN.includes(item)),
    };
  }
  if (type === "tool_call") {
    step.tool = String(raw.tool || "");
    step.input = raw.input && typeof raw.input === "object" ? raw.input : {};
    step.idempotencyKey = raw.idempotency_key || raw.idempotencyKey || null;
  }
  if (type === "notify") {
    step.message = String(raw.message || raw.instruction || "").slice(0, 2000);
    step.role = raw.role || raw.assignee?.role || null;
  }
  if (type === "branch") {
    step.next = normalizeNext(raw.next || raw.when);
  }
  if (raw.maxIterations != null) step.maxIterations = Math.min(Number(raw.maxIterations) || 3, 8);
  return step;
}

/**
 * @param {*} raw
 */
export function normalizeOpsDefinition(raw) {
  if (!raw || typeof raw !== "object") throw new Error("definition_required");
  const stepsIn = Array.isArray(raw.steps) ? raw.steps.slice(0, MAX_STEPS) : [];
  if (!stepsIn.length) throw new Error("steps_required");
  const steps = stepsIn.map((step, index) => normalizeStep(step, index));
  const inputs = Array.isArray(raw.inputs)
    ? raw.inputs.map((item) => ({
        name: asId(item.name, "input"),
        type: String(item.type || "string"),
      }))
    : [];
  return {
    slug: asId(raw.slug || raw.id, "process"),
    title: String(raw.title || raw.name || raw.slug || "Untitled process").slice(0, 120),
    trigger: raw.trigger && typeof raw.trigger === "object" ? raw.trigger : { type: "manual" },
    inputs,
    steps,
    assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String).slice(0, 30) : [],
  };
}

export function collectDefinitionTools(definition) {
  const names = new Set();
  for (const step of definition.steps || []) {
    if (step.type === "tool_call" && step.tool) names.add(step.tool);
    if (step.type === "agent_task") for (const tool of step.tools || []) names.add(tool);
  }
  return [...names];
}

export function findStep(definition, stepId) {
  return (definition.steps || []).find((step) => step.id === stepId) || null;
}
