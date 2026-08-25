/**
 * Nested agent-as-tool (CF-A-041): parent run delegates via `run_agent`
 * and the room timeline shows the child tool stream under that call.
 */

export const MAX_NESTED_AGENT_DEPTH = 2;

export const NESTED_AGENT_TOOL_NAMES = new Set([
  "run_agent",
  "invoke_agent",
  "delegate_agent",
]);

export function normalizeNestedToolName(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function isNestedAgentToolName(name) {
  return NESTED_AGENT_TOOL_NAMES.has(normalizeNestedToolName(name));
}

export function nestedAgentToolOpenAi() {
  return {
    type: "function",
    function: {
      name: "run_agent",
      description:
        "Delegate a subtask to another agent in this project. The child run streams its tools into this room under this call.",
      parameters: {
        type: "object",
        properties: {
          agentId: { type: "string", description: "Target agent id" },
          handle: { type: "string", description: "Target agent handle, e.g. @researcher" },
          prompt: { type: "string", description: "Task for the child agent" },
        },
        required: ["prompt"],
      },
    },
  };
}

function isRunAgentToolEntry(entry) {
  if (!entry || typeof entry !== "object") return false;
  const fn = entry.function;
  const name = typeof fn?.name === "string" ? fn.name : entry.name;
  return isNestedAgentToolName(name);
}

/**
 * Always expose `run_agent`. Without an HTTP executor, drop other tools so
 * the model cannot hallucinate un-runnable HTTP tools.
 */
export function withNestedAgentTool(tools, hasHttpExecutor) {
  const def = nestedAgentToolOpenAi();
  if (!hasHttpExecutor) return [def];
  const list = Array.isArray(tools) ? tools.slice() : [];
  if (list.some(isRunAgentToolEntry)) return list;
  list.push(def);
  return list;
}

export function parseNestedAgentToolArgs(rawArguments) {
  let args = rawArguments;
  if (typeof args === "string") {
    try {
      args = JSON.parse(args);
    } catch {
      return { ok: false, error: "nested_agent_invalid_arguments" };
    }
  }
  if (!args || typeof args !== "object") {
    return { ok: false, error: "nested_agent_invalid_arguments" };
  }
  const prompt = String(args.prompt ?? args.message ?? args.task ?? args.content ?? "").trim();
  if (!prompt) return { ok: false, error: "nested_agent_missing_prompt" };
  const agentId = String(args.agentId ?? args.id ?? "").trim();
  const handle = String(args.handle ?? args.agent ?? "").trim();
  if (!agentId && !handle) return { ok: false, error: "nested_agent_missing_target" };
  return { ok: true, prompt, agentId, handle };
}

export async function loadChildAgent(env, projectId, { agentId, handle }) {
  if (!env?.DB) return null;
  const normalizedHandle = String(handle || "")
    .replace(/^@/, "")
    .trim()
    .toLowerCase();
  if (agentId) {
    const byId = await env.DB.prepare(
      `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, allowed_tools
       FROM bots WHERE project_id = ? AND id = ?`,
    )
      .bind(projectId, agentId)
      .first();
    if (byId) return byId;
  }
  if (!normalizedHandle) return null;
  return env.DB.prepare(
    `SELECT id, name, handle, provider, model, config, system_prompt, context_fetch_url, tool_execute_url, tools_schema, rate_limit_rpm, allowed_tools
     FROM bots WHERE project_id = ? AND LOWER(REPLACE(handle, '@', '')) = ?`,
  )
    .bind(projectId, normalizedHandle)
    .first();
}

export function isSelfDelegate(parentAgentRow, childRow) {
  if (!parentAgentRow || !childRow) return false;
  if (parentAgentRow.id && childRow.id && parentAgentRow.id === childRow.id) return true;
  const parentHandle = String(parentAgentRow.handle || "")
    .replace(/^@/, "")
    .toLowerCase();
  const childHandle = String(childRow.handle || "")
    .replace(/^@/, "")
    .toLowerCase();
  return Boolean(parentHandle && parentHandle === childHandle);
}

/**
 * @param {{
 *   executeAgentRun: Function,
 *   env: object,
 *   projectId: string,
 *   roomId: string,
 *   userId: string,
 *   traceId: string,
 *   parentAgentRow: object,
 *   parentRunId: string,
 *   toolCall: { id: string, name: string, arguments: string },
 *   nestDepth: number,
 * }} input
 */
export async function runNestedAgentTool(input) {
  const nestDepth = Math.max(0, Number(input.nestDepth) || 0);
  if (nestDepth >= MAX_NESTED_AGENT_DEPTH) {
    return { success: false, error: "nested_agent_depth_exceeded" };
  }
  const parsed = parseNestedAgentToolArgs(input.toolCall?.arguments);
  if (!parsed.ok) return { success: false, error: parsed.error };
  const child = await loadChildAgent(input.env, input.projectId, parsed);
  if (!child) return { success: false, error: "nested_agent_not_found" };
  if (isSelfDelegate(input.parentAgentRow, child)) {
    return { success: false, error: "nested_agent_self" };
  }
  const result = await input.executeAgentRun(input.env, {
    agentRow: child,
    projectId: input.projectId,
    roomId: input.roomId,
    userMessage: parsed.prompt,
    userId: input.userId,
    traceId: input.traceId,
    parentRunId: input.parentRunId,
    parentToolCallId: input.toolCall.id,
    nestDepth: nestDepth + 1,
  });
  if (result?.status !== "completed") {
    return {
      success: false,
      error: result?.error || "nested_agent_failed",
      result,
    };
  }
  return {
    success: true,
    result: {
      runId: result.runId,
      agentId: child.id,
      handle: child.handle || null,
      content: result.content,
      toolCalls: result.toolCalls || [],
      iterations: result.iterations,
    },
  };
}
