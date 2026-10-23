/**
 * The tool-invocation log: the gateway writes one of these for every call
 * attempt, so the project has a record even when the call never ran.
 * `denied` = blocked before execution (policy, budget, kill switch);
 * `failed` = executed but the tool itself returned an error.
 */
export const OPS_TOOL_EVENT_TYPES = [
  "ops.tool.called",
  "ops.tool.approval_required",
  "ops.tool.input_required",
  "ops.tool.input_answered",
  "ops.tool.denied",
  "ops.tool.failed",
];
