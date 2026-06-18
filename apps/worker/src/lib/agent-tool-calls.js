/**
 * Normalize and validate LLM tool calls before executing against customer endpoints (P1-3).
 */

/**
 * Audit A-5: parse the AGENT_TOOL_ALLOWLIST env var (comma-separated) into
 * a Set. Returns:
 *   - null when the env var is not set at all (operator not opted in;
 *     fall through to the project-level / DB-level allow-list)
 *   - an empty Set when the env var is set to "" (fail-closed: deny all)
 *   - a Set of trimmed tool names when the env var is set to a
 *     non-empty value (deny anything not in the list)
 *
 * Critically: we use `in env` (or hasOwnProperty) to distinguish
 * "env var set to empty string" from "env var absent"  the brief
 * requires fail-closed on empty string but legacy behaviour
 * (no enforcement) when absent, so existing deployments are not
 * silently broken.
 */
export function parseAgentToolAllowListFromEnv(env) {
  if (!env || !Object.prototype.hasOwnProperty.call(env, "AGENT_TOOL_ALLOWLIST")) {
    return null;
  }
  const raw = env.AGENT_TOOL_ALLOWLIST;
  if (typeof raw !== "string") return new Set();
  if (raw.length === 0) return new Set();
  const parts = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return new Set(parts);
}

/**
 * @param {unknown} toolCallRaw
 * @returns {{ id: string, name: string, arguments: unknown } | null}
 */
export function normalizeToolCallShape(toolCallRaw) {
  if (!toolCallRaw || typeof toolCallRaw !== "object") return null;
  const tc = /** @type {Record<string, unknown>} */ (toolCallRaw);
  const id = typeof tc.id === "string" ? tc.id : "";

  const fn = tc.function;
  if (fn && typeof fn === "object") {
    const fnObj = /** @type {Record<string, unknown>} */ (fn);
    const name = typeof fnObj.name === "string" ? fnObj.name : "";
    return { id, name, arguments: fnObj.arguments };
  }

  const name = typeof tc.name === "string" ? tc.name : "";
  return { id, name, arguments: tc.arguments };
}

/**
 * @param {unknown} toolCallRaw
 * @param {Array<{ function?: { name?: string } }>|null} registeredTools
 * @param {string} runId
 * @param {Set<string>|null} [projectAllowList]  project-curated tool names.
 *   When non-null, the LLM's tool name must be in BOTH `registeredTools` and
 *   this set. An empty set denies all tool calls. A `null` set means the
 *   operator has not opted into a project allow-list (legacy behaviour).
 * @param {Set<string>|null} [envAllowList]  global env-driven allow-list
 *   (AGENT_TOOL_ALLOWLIST). When non-null (including empty), the tool name
 *   must be in this set. A `null` set means the env var is absent and the
 *   global gate is skipped.
 * @returns {{ valid: boolean, toolCall: { id: string, name: string, arguments: string }|null, warning: string|null }}
 */
export function validateToolCall(toolCallRaw, registeredTools, runId, projectAllowList = null, envAllowList = null) {
  const normalized = normalizeToolCallShape(toolCallRaw);
  if (!normalized) {
    return {
      valid: false,
      toolCall: null,
      warning: `invalid_tool_call_not_object runId=${runId} rawType=${typeof toolCallRaw}`,
    };
  }

  const { id, name, arguments: rawArgs } = normalized;

  if (!id) {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_missing_id runId=${runId} id=${JSON.stringify(id)}`,
    };
  }
  if (!name) {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_missing_name runId=${runId} name=${JSON.stringify(name)}`,
    };
  }
  if (rawArgs === undefined || rawArgs === null) {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_null_arguments runId=${runId} name=${name}`,
    };
  }

  let parsedArgs;
  if (typeof rawArgs === "string") {
    try {
      parsedArgs = JSON.parse(rawArgs);
    } catch {
      return {
        valid: false,
        toolCall: null,
        warning: `tool_call_invalid_arguments_json runId=${runId} name=${name}`,
      };
    }
  } else if (typeof rawArgs === "object") {
    parsedArgs = rawArgs;
  } else {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_invalid_arguments_type runId=${runId} name=${name} type=${typeof rawArgs}`,
    };
  }

  // Audit A-5: global env-driven allow-list gate. When the env var is
  // present (even as empty string), it is the highest-priority gate 
  // we check it FIRST so the operator can be confident that the env
  // var alone is sufficient to lock down tool access without needing
  // to also configure every project.
  if (envAllowList !== null && !envAllowList.has(name)) {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_blocked_by_env_allowlist runId=${runId} name=${name}`,
    };
  }

  // S-35 / audit: even if `registeredTools` is the schema the LLM was told
  // about, the LLM can still hallucinate a tool name we did not intend. The
  // project allow-list is a hard second gate.
  if (registeredTools) {
    const nameOk = registeredTools.some((t) => t.function?.name === name);
    if (!nameOk) {
      return {
        valid: false,
        toolCall: null,
        warning: `tool_call_unknown_name runId=${runId} name=${name}`,
      };
    }
  }
  if (projectAllowList && !projectAllowList.has(name)) {
    return {
      valid: false,
      toolCall: null,
      warning: `tool_call_blocked_by_project_allowlist runId=${runId} name=${name}`,
    };
  }

  return {
    valid: true,
    toolCall: { id, name, arguments: JSON.stringify(parsedArgs) },
    warning: null,
  };
}

/**
 * @param {object} response - OpenAI chat completion JSON
 * @param {Array<object>|null} registeredTools
 * @param {string} runId
 * @param {Set<string>|null} [projectAllowList]
 * @param {Set<string>|null} [envAllowList]
 */
export function extractOpenAIToolCalls(response, registeredTools, runId, projectAllowList = null, envAllowList = null) {
  const choice = response.choices?.[0];
  if (!choice) return { content: null, toolCalls: [], finishReason: null, invalidWarnings: [] };
  const content = choice.message?.content || null;
  const rawToolCalls = choice.message?.tool_calls || [];
  const toolCalls = [];
  const invalidWarnings = [];
  for (const tc of rawToolCalls) {
    const validated = validateToolCall(tc, registeredTools, runId, projectAllowList, envAllowList);
    if (validated.valid && validated.toolCall) {
      toolCalls.push(validated.toolCall);
    }
    if (validated.warning) {
      invalidWarnings.push(validated.warning);
    }
  }
  return { content, toolCalls, finishReason: choice.finish_reason, invalidWarnings };
}

/**
 * @param {object} response - Anthropic messages JSON
 * @param {Array<object>|null} registeredTools
 * @param {string} runId
 * @param {Set<string>|null} [projectAllowList]
 * @param {Set<string>|null} [envAllowList]
 */
export function extractAnthropicToolCalls(response, registeredTools, runId, projectAllowList = null, envAllowList = null) {
  let content = null;
  const toolCalls = [];
  const invalidWarnings = [];
  for (const block of response.content || []) {
    if (block.type === "text") content = (content || "") + block.text;
    if (block.type === "tool_use") {
      const validated = validateToolCall(
        { id: block.id, name: block.name, arguments: block.input },
        registeredTools,
        runId,
        projectAllowList,
        envAllowList,
      );
      if (validated.valid && validated.toolCall) {
        toolCalls.push(validated.toolCall);
      }
      if (validated.warning) {
        invalidWarnings.push(validated.warning);
      }
    }
  }
  return { content, toolCalls, stopReason: response.stop_reason, invalidWarnings };
}
