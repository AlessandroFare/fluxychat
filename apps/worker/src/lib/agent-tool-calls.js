/**
 * Normalize and validate LLM tool calls before executing against customer endpoints (P1-3).
 */

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
 * @returns {{ valid: boolean, toolCall: { id: string, name: string, arguments: string }|null, warning: string|null }}
 */
export function validateToolCall(toolCallRaw, registeredTools, runId) {
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
 */
export function extractOpenAIToolCalls(response, registeredTools, runId) {
  const choice = response.choices?.[0];
  if (!choice) return { content: null, toolCalls: [], finishReason: null, invalidWarnings: [] };
  const content = choice.message?.content || null;
  const rawToolCalls = choice.message?.tool_calls || [];
  const toolCalls = [];
  const invalidWarnings = [];
  for (const tc of rawToolCalls) {
    const validated = validateToolCall(tc, registeredTools, runId);
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
 */
export function extractAnthropicToolCalls(response, registeredTools, runId) {
  let content = null;
  const toolCalls = [];
  const invalidWarnings = [];
  for (const block of response.content || []) {
    if (block.type === "text") content = (content || "") + block.text;
    if (block.type === "tool_use") {
      const validated = validateToolCall(
        { id: block.id, name: block.name, arguments: block.input },
        registeredTools,
        runId
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
