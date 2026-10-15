import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { assertToolAllowed, impliedCanRead, mergeProjectTools, normalizeOpsPolicy } from "./ops-policy.js";
import { collectDefinitionTools } from "./ops-definition.js";

/**
 * Runtime enforcement. The agent prompt is not consulted.
 */
export async function createOpsToolGateway({ store, projectId, run, definition, policy, execute }) {
  const tools = mergeProjectTools(await store.listTools(projectId));
  const allowlist = collectDefinitionTools(definition);
  const resolvedPolicy = normalizeOpsPolicy(policy || (await store.getPolicy(projectId)));

  return {
    tools,
    policy: resolvedPolicy,
    async call(toolName, input, { actor, simulate } = {}) {
      if (run?.killSwitch) return { ok: false, error: "kill_switch" };
      const tool = tools.find((item) => item.name === toolName);
      const allowed = assertToolAllowed(tool, { publishedAllowlist: allowlist });
      if (!allowed.ok) return allowed;
      if (tool.side === "write" && resolvedPolicy.defaultWriteEffect === "deny" && !tool.enabled) {
        return { ok: false, error: "write_denied" };
      }
      const budget = (await store.getBudget(projectId, run.id)) || {
        projectId,
        runId: run.id,
        maxToolCalls: resolvedPolicy.budgets.maxToolCallsPerRun,
        maxTokens: resolvedPolicy.budgets.maxTokensPerRun,
        toolCalls: 0,
        tokens: 0,
      };
      if (budget.toolCalls + 1 > (budget.maxToolCalls || resolvedPolicy.budgets.maxToolCallsPerRun)) {
        return { ok: false, error: "budget_exceeded", interruptReason: "budget-exceeded" };
      }
      if (simulate && tool.side === "write") {
        return { ok: true, mocked: true, tool: toolName, input };
      }
      if (tool.side === "write" && !simulate) {
        const pending = (await store.listEvents(projectId, run.id)).filter(
          (event) => event.eventType === "ops.approval.granted" && event.result?.tool === toolName,
        );
        const hash = await canonicalPayloadHash({ tool: toolName, input });
        const grant = pending.find((event) => event.inputHash === hash);
        if (!grant) return { ok: false, error: "approval_required", payloadHash: hash, tool: toolName, input };
      }
      if (toolName === "db.query_named_view") {
        const view = String(input?.view || "");
        if (!resolvedPolicy.allowedViews.includes(view)) return { ok: false, error: "view_not_allowed" };
      }
      budget.toolCalls += 1;
      await store.saveBudget(budget);
      run.cost = { ...run.cost, toolCalls: budget.toolCalls };
      const result = execute
        ? await execute(toolName, input, { tool, actor, canRead: impliedCanRead(tool.side) })
        : { ok: true, tool: toolName, input };
      await store.appendEvent({
        projectId,
        runId: run.id,
        actor: actor || "system",
        eventType: "ops.tool.called",
        inputHash: await canonicalPayloadHash({ tool: toolName, input }),
        result: { ok: result?.ok !== false, mocked: Boolean(result?.mocked) },
      });
      return result;
    },
  };
}

export async function bindApprovalPayload(store, { projectId, runId, stepId, tool, input, required }) {
  const payload = { tool, input };
  const payloadHash = await canonicalPayloadHash(payload);
  return store.createApproval({
    projectId,
    runId,
    stepId,
    payload,
    payloadHash,
    required: required || 1,
    decisions: [],
    status: "pending",
  });
}

export async function decideOpsApproval(store, { projectId, approvalId, actor, decision, payloadHash }) {
  const row = await store.getApproval(projectId, approvalId);
  if (!row) return { ok: false, error: "not_found" };
  if (row.status !== "pending") return { ok: false, error: "already_decided" };
  if (payloadHash && payloadHash !== row.payloadHash) {
    row.status = "void";
    await store.saveApproval(row);
    return { ok: false, error: "payload_changed" };
  }
  row.decisions.push({ actor, decision, at: new Date().toISOString() });
  const approved = row.decisions.filter((item) => item.decision === "approve").length;
  const denied = row.decisions.some((item) => item.decision === "deny");
  if (denied) row.status = "denied";
  else if (approved >= (row.required || 1)) row.status = "approved";
  await store.saveApproval(row);
  if (row.status === "approved") {
    await store.appendEvent({
      projectId,
      runId: row.runId,
      actor,
      eventType: "ops.approval.granted",
      inputHash: row.payloadHash,
      result: { tool: row.payload.tool, input: row.payload.input },
    });
  }
  return { ok: true, approval: row };
}
