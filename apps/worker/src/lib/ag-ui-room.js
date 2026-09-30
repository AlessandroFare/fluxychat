/**
 * Map a stored agent_runs row to AG-UI-shaped events (LangGraph / CrewAI / Pydantic AI).
 * This is a join surface, not a CopilotKit host.
 */

export function agentRunToAgUiEvents(run) {
  const runId = run?.id || run?.runId || "";
  const events = [
    {
      type: "RUN_STARTED",
      runId,
      agentId: run?.agentId || null,
      roomId: run?.roomId || null,
    },
  ];
  const calls = Array.isArray(run?.toolCalls) ? run.toolCalls : [];
  for (const tc of calls) {
    const toolCallId = String(tc.id || tc.toolCallId || crypto.randomUUID());
    const toolName = String(tc.name || tc.toolName || "tool");
    let args = tc.arguments ?? tc.args ?? {};
    if (typeof args === "string") {
      try {
        args = JSON.parse(args);
      } catch {
        args = { raw: args };
      }
    }
    events.push({
      type: "TOOL_CALL_START",
      toolName,
      toolCallId,
      args: args && typeof args === "object" ? args : {},
    });
    if (tc.result != null || tc.output != null || tc.error) {
      events.push({
        type: "TOOL_CALL_RESULT",
        toolName,
        toolCallId,
        ok: !tc.error,
        output: tc.result ?? tc.output ?? null,
        error: tc.error || null,
      });
    }
  }
  events.push({
    type: "RUN_FINISHED",
    runId,
    status: run?.status || "unknown",
    latencyMs: run?.latencyMs ?? null,
    estimatedCost: run?.estimatedCost ?? null,
  });
  return events;
}

export function encodeAgUiSse(events) {
  return events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n";
}
