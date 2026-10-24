import { canonicalPayloadHash } from "./canonical-payload-hash.js";
import { assertToolAllowed, impliedCanRead, mergeProjectTools, normalizeOpsPolicy } from "./ops-policy.js";
import { collectDefinitionTools } from "./ops-definition.js";
import { mcpCallIsPinnedReadOnly } from "./ops-mcp.js";

/**
 * Runtime enforcement. The agent prompt is not consulted.
 */
export async function createOpsToolGateway({ store, projectId, run, definition, policy, execute }) {
  const tools = mergeProjectTools(await store.listTools(projectId));
  const allowlist = collectDefinitionTools(definition);
  const resolvedPolicy = normalizeOpsPolicy(policy || (await store.getPolicy(projectId)));

  async function attempt(toolName, input, { actor, simulate, meta, resumed } = {}) {
    if (run?.killSwitch) return { ok: false, error: "kill_switch" };
    const tool = tools.find((item) => item.name === toolName);
    // C7: a tool ACL beats the project allowlist. Only a mocked write (the
    // builder's dry-run preview) is exempt — reads really execute in simulate.
    if (!(simulate && tool?.side === "write")) {
      const acl = (resolvedPolicy.toolAcls || []).find((item) => item.tool === toolName);
      if (acl) {
        const actorId = run?.trigger?.actor || null;
        const roles = Array.isArray(run?.trigger?.roles) ? run.trigger.roles : [];
        const permitted = acl.allow.some((selector) =>
          selector.startsWith("user:")
            ? selector.slice(5) === actorId
            : roles.includes(selector.slice(5)),
        );
        if (!permitted) return { ok: false, error: "tool_acl_denied", tool: toolName };
      }
    }
    const allowed = assertToolAllowed(tool, { publishedAllowlist: allowlist });
    if (!allowed.ok) return allowed;
    if (tool.side === "write" && resolvedPolicy.defaultWriteEffect === "deny" && !tool.enabled) {
      return { ok: false, error: "write_denied" };
    }
    // C5: rolling per-tool quota, counted from the tool-call log. Denied-by-quota
    // calls are not counted, so the window is "calls that actually ran".
    const quota = (resolvedPolicy.toolQuotas || []).find((item) => item.tool === toolName);
    if (quota) {
      const since = new Date(Date.now() - quota.windowMinutes * 60_000).toISOString();
      const used = await store.countToolCallsSince(projectId, { tool: toolName, since });
      if (used >= quota.max) {
        return {
          ok: false,
          error: "tool_quota_exceeded",
          tool: toolName,
          limit: quota.max,
          windowMinutes: quota.windowMinutes,
        };
      }
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
    // A resumed MRTR call is the same call continuing (its grant was consumed
    // on the first attempt); demanding a second grant would dead-end the run.
    // A pinned read-only mcp.call goes straight through: the approved
    // definition says it reads, so the write approval does not apply.
    const readOnlyMcpCall =
      tool.side === "write" &&
      !simulate &&
      !resumed &&
      toolName === "mcp.call" &&
      (await mcpCallIsPinnedReadOnly(store, projectId, input));
    if (tool.side === "write" && !simulate && !resumed && !readOnlyMcpCall) {
      const events = await store.listEvents(projectId, run.id);
      // OPS-03: an approval grant is single-use. The matching input hash must
      // not have been consumed by an earlier call.
      const consumed = new Set(
        events.filter((event) => event.eventType === "ops.approval.consumed").map((event) => event.inputHash),
      );
      const pending = events.filter(
        (event) =>
          event.eventType === "ops.approval.granted" &&
          event.result?.tool === toolName &&
          !consumed.has(event.inputHash),
      );
      const hash = await canonicalPayloadHash({ tool: toolName, input });
      const grant = pending.find((event) => event.inputHash === hash);
      if (!grant) return { ok: false, error: "approval_required", payloadHash: hash, tool: toolName, input };
      await store.appendEvent({
        projectId,
        runId: run.id,
        actor: actor || "system",
        eventType: "ops.approval.consumed",
        inputHash: hash,
        result: { tool: toolName },
      });
    }
    if (toolName === "db.query_named_view") {
      const view = String(input?.view || "");
      if (!resolvedPolicy.allowedViews.includes(view)) return { ok: false, error: "view_not_allowed" };
    }
    budget.toolCalls += 1;
    await store.saveBudget(budget);
    run.cost = { ...run.cost, toolCalls: budget.toolCalls };
    if (meta) meta.executed = true;
    const result = execute
      ? await execute(toolName, input, { tool, actor, canRead: impliedCanRead(tool.side), roomId: run?.roomId || null, runId: run?.id || null })
      : { ok: true, tool: toolName, input };
    return readOnlyMcpCall ? { ...(result || {}), readOnlyFastPath: true } : result;
  }

  return {
    tools,
    policy: resolvedPolicy,
    async call(toolName, input, { actor, simulate, resumed } = {}) {
      const meta = { executed: false };
      const result = await attempt(toolName, input, { actor, simulate, meta, resumed });
      // Every invocation is logged — ran, waiting on the frozen payload, waiting
      // on the user, denied before execution, or failed in the tool — with the
      // hash of { tool, input } as the audit link.
      const eventType =
        result?.ok !== false
          ? "ops.tool.called"
          : result?.error === "approval_required"
            ? "ops.tool.approval_required"
            : result?.error === "input_required"
              ? "ops.tool.input_required"
              : meta.executed
                ? "ops.tool.failed"
                : "ops.tool.denied";
      await store.appendEvent({
        projectId,
        runId: run.id,
        actor: actor || "system",
        eventType,
        inputHash: await canonicalPayloadHash({ tool: toolName, input }),
        result:
          eventType === "ops.tool.called"
            ? {
                ok: true,
                tool: toolName,
                mocked: Boolean(result?.mocked),
                ...(result?.readOnlyFastPath ? { readOnlyFastPath: true } : {}),
                // C6/I6: the log says the output is confidential, never stores it.
                ...((resolvedPolicy.confidentialTools || []).includes(toolName) ? { confidential: true } : {}),
                ...(result?.guardrails ? { guardrails: result.guardrails } : {}),
              }
            : eventType === "ops.tool.approval_required"
              ? { ok: false, tool: toolName, payloadHash: result.payloadHash }
              : {
                  ok: false,
                  tool: toolName,
                  error: String(result?.error || "unknown"),
                  ...(result?.rule ? { rule: result.rule } : {}),
                },
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
  // OPS-03: one vote per actor — quorum must come from distinct people.
  if (row.decisions.some((item) => item.actor === actor)) {
    return { ok: false, error: "duplicate_decision" };
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
