import { collectDefinitionTools, normalizeOpsDefinition } from "./ops-definition.js";
import { evalJsonLogic } from "./ops-jsonlogic.js";
import { registryByName } from "./ops-policy.js";

function issues() {
  return { errors: [], warnings: [] };
}

function add(bag, level, code, message, stepId) {
  bag[level].push({ code, message, stepId: stepId || null });
}

function neighbors(step) {
  if (!step?.next || step.type === "end") return [];
  if (typeof step.next === "string") return [step.next];
  if (Array.isArray(step.next)) return step.next.map((branch) => branch.to).filter(Boolean);
  return [];
}

/**
 * Schema + policy lint. Blocks publication when errors.length > 0.
 */
export function lintOpsDefinition(raw, { tools, policy } = {}) {
  const bag = issues();
  let definition;
  try {
    definition = normalizeOpsDefinition(raw);
  } catch (err) {
    add(bag, "errors", "invalid_definition", err instanceof Error ? err.message : "invalid");
    return { ok: false, definition: null, ...bag };
  }

  const ids = definition.steps.map((step) => step.id);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) add(bag, "errors", "duplicate_step_id", "Step ids must be unique");

  const registry = registryByName(tools || []);
  const usedTools = collectDefinitionTools(definition);

  for (const name of usedTools) {
    const tool = registry.get(name);
    if (!tool || tool.enabled !== true) {
      add(bag, "errors", "unknown_tool", `Tool ${name} is not enabled in this workspace`);
    }
  }

  const writeSteps = definition.steps.filter((step) => {
    if (step.type !== "tool_call") return false;
    const tool = registry.get(step.tool);
    return !tool || tool.side === "write";
  });

  function priorApprovals(stepId, seen = new Set()) {
    if (seen.has(stepId)) return false;
    seen.add(stepId);
    const incoming = definition.steps.filter((step) => neighbors(step).includes(stepId));
    if (!incoming.length) return false;
    return incoming.every((step) => {
      if (step.type === "approval") return true;
      if (step.type === "end") return false;
      return priorApprovals(step.id, seen);
    });
  }

  for (const step of writeSteps) {
    const tool = registry.get(step.tool);
    const hasApproval = priorApprovals(step.id);
    if (!hasApproval) {
      add(bag, "errors", "write_requires_approval", `Write tool ${step.tool} needs an approval step before it`, step.id);
    }
    if (tool?.risk === "high") {
      const approval = definition.steps.find((item) => neighbors(item).includes(step.id) && item.type === "approval");
      const required = Number(approval?.quorum?.default) || 1;
      const min = Number(policy?.highRiskQuorum) || 2;
      if (required < min) {
        add(bag, "errors", "high_risk_quorum", `High-risk tool ${step.tool} requires quorum ${min}`, step.id);
      }
    }
  }

  for (const step of definition.steps) {
    if (!step.timeout?.afterMs) add(bag, "errors", "timeout_required", "Every step needs a timeout", step.id);
    if (step.type === "agent_task") {
      if (!step.tools?.length) add(bag, "errors", "agent_allowlist", "agent_task needs a tool allowlist", step.id);
      if (!step.budget?.maxToolCalls || !step.budget?.maxTokens) {
        add(bag, "errors", "agent_budget", "agent_task needs a budget", step.id);
      }
      if ((step.tools || []).includes("files.search") && step.cite === false) {
        add(bag, "errors", "citations_required", "agent_task that searches files must cite sources", step.id);
      }
    }
    if (step.type === "tool_call" && !step.tool) add(bag, "errors", "tool_required", "tool_call needs tool", step.id);
    if (step.type === "tool_call" && step.tool) {
      const required = registry.get(step.tool)?.inputSchema?.required;
      const input = step.input || {};
      const missing = (Array.isArray(required) ? required : []).filter((key) => input[key] === undefined);
      if (missing.length) {
        // The run context may still supply these (trigger body, toolInputs), so
        // this is advisory: it catches drafts that would fail at runtime.
        add(
          bag,
          "warnings",
          "tool_input_missing",
          `${step.tool} is missing required input ${missing.join(", ")} — set it in the step input or provide it from the run context`,
          step.id,
        );
      }
    }
    if (step.type === "wait_for_guest" && !step.guest?.can?.length) {
      add(bag, "errors", "guest_scope", "Guest steps need a can[] scope", step.id);
    }
    for (const nextId of neighbors(step)) {
      if (nextId !== "end" && !idSet.has(nextId)) {
        add(bag, "errors", "unknown_next", `Step ${step.id} points to missing ${nextId}`, step.id);
      }
    }
  }

  const start = definition.steps[0]?.id;
  const reachable = new Set();
  const queue = start ? [start] : [];
  while (queue.length) {
    const id = queue.shift();
    if (!id || reachable.has(id)) continue;
    reachable.add(id);
    const step = definition.steps.find((item) => item.id === id);
    for (const nextId of neighbors(step)) {
      if (nextId !== "end") queue.push(nextId);
    }
  }
  for (const step of definition.steps) {
    if (step.type !== "end" && !reachable.has(step.id)) {
      add(bag, "errors", "unreachable", `Step ${step.id} is unreachable`, step.id);
    }
  }

  const visitCap = {};
  function walk(id, stack) {
    if (!id || id === "end") return;
    visitCap[id] = (visitCap[id] || 0) + 1;
    const step = definition.steps.find((item) => item.id === id);
    const max = step?.maxIterations || 8;
    if (visitCap[id] > max) {
      add(bag, "errors", "unbounded_loop", `Loop through ${id} exceeds maxIterations`, id);
      return;
    }
    if (stack.includes(id) && !step?.maxIterations) {
      add(bag, "errors", "unbounded_loop", `Cycle through ${id} needs maxIterations`, id);
      return;
    }
    for (const nextId of neighbors(step)) walk(nextId, [...stack, id]);
  }
  if (start) walk(start, []);

  if (policy?.amountQuorum?.if) {
    try {
      evalJsonLogic(policy.amountQuorum.if, { total: 0 });
    } catch {
      add(bag, "errors", "policy_expression", "amountQuorum.if is not valid JSONLogic");
    }
  }

  return {
    ok: bag.errors.length === 0,
    definition,
    ...bag,
  };
}
