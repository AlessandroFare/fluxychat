export function toolNamesFromEvalRun(run?: {
  tool_calls?: Array<{ name?: string; toolName?: string; tool?: string }>;
  tool_calls_json?: string;
} | null): string[] {
  if (!run) return [];
  if (Array.isArray(run.tool_calls)) {
    return run.tool_calls
      .map((t: { name?: string; toolName?: string; tool?: string }) =>
        String(t?.name ?? t?.toolName ?? t?.tool ?? "").trim(),
      )
      .filter(Boolean);
  }
  if (!run.tool_calls_json) return [];
  try {
    const parsed = JSON.parse(String(run.tool_calls_json));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((t: { name?: string; toolName?: string; tool?: string }) =>
        String(t?.name ?? t?.toolName ?? t?.tool ?? "").trim(),
      )
      .filter(Boolean);
  } catch {
    return [];
  }
}

export interface TranscriptEvalCase {
  tag?: string;
  name?: string;
  expectedStatus?: string;
  maxLatencyMs?: number;
  mustNotError?: boolean;
  minToolCalls?: number;
  maxToolCalls?: number;
  requiredTools?: string[];
  expectedOutputContains?: string;
  forbiddenOutputContains?: string;
}

export interface TranscriptEvalRun {
  id?: string;
  tag?: string;
  status?: string;
  latency_ms?: number;
  error?: string | null;
  tool_calls?: Array<{ name?: string; toolName?: string; tool?: string }>;
  tool_calls_json?: string;
  output?: string;
  content?: string;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
}

export interface TranscriptEvalFile {
  cases?: TranscriptEvalCase[];
  runs?: TranscriptEvalRun[];
  /** Used by `fluxy-eval replay` when --prompt is omitted. */
  prompt?: string;
  agentId?: string;
  roomId?: string;
}

export function scoreEvalCaseAgainstTranscript(
  match: TranscriptEvalRun | null | undefined,
  evalCase: TranscriptEvalCase,
  outputSnippet = "",
) {
  const expectStatus = evalCase.expectedStatus ?? "completed";
  const maxLatencyMs = Number(evalCase.maxLatencyMs ?? 30000);
  const tag = evalCase.tag ?? evalCase.name ?? "case";

  if (!match) {
    return {
      tag,
      passed: false,
      reason: "no_matching_run",
      runId: null,
      status: null,
      latencyMs: null,
    };
  }

  let passed = true;
  let reason = "ok";

  if (match.status !== expectStatus) {
    passed = false;
    reason = `status_${match.status}_expected_${expectStatus}`;
  } else if (match.latency_ms != null && match.latency_ms > maxLatencyMs) {
    passed = false;
    reason = `latency_${match.latency_ms}_max_${maxLatencyMs}`;
  } else if (evalCase.mustNotError && match.error) {
    passed = false;
    reason = "unexpected_error";
  } else {
    const tools = toolNamesFromEvalRun(match);
    if (evalCase.minToolCalls != null && tools.length < Number(evalCase.minToolCalls)) {
      passed = false;
      reason = `tool_count_${tools.length}_min_${evalCase.minToolCalls}`;
    } else if (evalCase.maxToolCalls != null && tools.length > Number(evalCase.maxToolCalls)) {
      passed = false;
      reason = `tool_count_${tools.length}_max_${evalCase.maxToolCalls}`;
    } else if (Array.isArray(evalCase.requiredTools) && evalCase.requiredTools.length) {
      for (const required of evalCase.requiredTools) {
        const needle = String(required).toLowerCase();
        if (!tools.some((name: string) => name.toLowerCase() === needle || name.toLowerCase().includes(needle))) {
          passed = false;
          reason = `missing_tool_${required}`;
          break;
        }
      }
    }
  }

  const snippet = outputSnippet || String(match.output ?? match.content ?? "");
  if (passed && evalCase.expectedOutputContains) {
    const needle = String(evalCase.expectedOutputContains).toLowerCase();
    if (!snippet.toLowerCase().includes(needle)) {
      passed = false;
      reason = "output_missing_expected";
    }
  }
  if (passed && evalCase.forbiddenOutputContains) {
    const needle = String(evalCase.forbiddenOutputContains).toLowerCase();
    if (snippet.toLowerCase().includes(needle)) {
      passed = false;
      reason = "output_contains_forbidden";
    }
  }

  return {
    tag,
    passed,
    reason,
    runId: match.id ?? null,
    status: match.status ?? null,
    latencyMs: match.latency_ms ?? null,
    outputChecked: Boolean(snippet),
  };
}

export function matchRunForCase(
  evalCase: TranscriptEvalCase,
  runs: TranscriptEvalRun[],
  index: number,
): TranscriptEvalRun | undefined {
  const tag = evalCase.tag ?? evalCase.name;
  if (tag) {
    const byTag = runs.find((run) => run.tag === tag || run.id === tag);
    if (byTag) return byTag;
  }
  return runs[index];
}

export function scoreTranscriptEvalFile(file: TranscriptEvalFile) {
  const cases = Array.isArray(file.cases) ? file.cases : [];
  const runs = Array.isArray(file.runs) ? file.runs : [];
  const results = cases.map((evalCase, index) =>
    scoreEvalCaseAgainstTranscript(matchRunForCase(evalCase, runs, index), evalCase),
  );
  const passed = results.filter((row) => row.passed).length;
  return {
    ok: results.length > 0 && passed === results.length,
    passed,
    failed: results.length - passed,
    results,
  };
}

export interface LiveEvalInvokeResult {
  run: {
    id?: string;
    status?: string;
    latencyMs?: number;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
    toolCalls?: Array<{ name?: string; toolName?: string; tool?: string }>;
    error?: string | null;
  };
  message?: { content?: string };
}

export function transcriptRunFromLiveInvoke(live: LiveEvalInvokeResult): TranscriptEvalRun {
  return {
    id: live.run?.id,
    status: live.run?.status,
    latency_ms: live.run?.latencyMs,
    input_tokens: live.run?.inputTokens,
    output_tokens: live.run?.outputTokens,
    estimated_cost: live.run?.estimatedCost,
    error: live.run?.error ?? null,
    tool_calls: live.run?.toolCalls,
    output: live.message?.content,
  };
}

export function diffLiveVsBaseline(baseline: TranscriptEvalRun | undefined, live: TranscriptEvalRun) {
  const baseTools = toolNamesFromEvalRun(baseline || {}).map((n: string) => n.toLowerCase());
  const liveTools = toolNamesFromEvalRun(live).map((n: string) => n.toLowerCase());
  const baseSet = new Set(baseTools);
  const liveSet = new Set(liveTools);
  const added = liveTools.filter((n: string) => !baseSet.has(n));
  const removed = baseTools.filter((n: string) => !liveSet.has(n));
  const baseCost = Number(baseline?.estimated_cost ?? 0);
  const liveCost = Number(live.estimated_cost ?? 0);
  const baseIn = Number(baseline?.input_tokens ?? 0);
  const liveIn = Number(live.input_tokens ?? 0);
  const baseOut = Number(baseline?.output_tokens ?? 0);
  const liveOut = Number(live.output_tokens ?? 0);
  return {
    sameTools: added.length === 0 && removed.length === 0,
    toolsAdded: [...new Set(added)],
    toolsRemoved: [...new Set(removed)],
    costDelta: liveCost - baseCost,
    inputTokenDelta: liveIn - baseIn,
    outputTokenDelta: liveOut - baseOut,
    baselineRunId: baseline?.id ?? null,
    liveRunId: live.id ?? null,
  };
}

export async function invokeAgentForEval(options: {
  workerUrl: string;
  token: string;
  agentId: string;
  roomId: string;
  prompt: string;
  fetchImpl?: typeof fetch;
}): Promise<LiveEvalInvokeResult> {
  const base = options.workerUrl.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const res = await fetchImpl(`${base}/agents/${encodeURIComponent(options.agentId)}/invoke`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${options.token}`,
    },
    body: JSON.stringify({
      roomId: options.roomId,
      content: options.prompt,
      stream: false,
    }),
  });
  const text = await res.text();
  let body: LiveEvalInvokeResult & { error?: string };
  try {
    body = JSON.parse(text) as LiveEvalInvokeResult & { error?: string };
  } catch {
    throw new Error(`invoke_failed_${res.status}`);
  }
  if (!res.ok) {
    throw new Error(body.error || `invoke_failed_${res.status}`);
  }
  if (!body.run) throw new Error("invoke_missing_run");
  return body;
}

export function scoreLiveReplay(file: TranscriptEvalFile, live: TranscriptEvalRun) {
  const cases = Array.isArray(file.cases) ? file.cases : [];
  const baseline = Array.isArray(file.runs) ? file.runs[0] : undefined;
  const results = cases.map((evalCase) => scoreEvalCaseAgainstTranscript(live, evalCase));
  const passed = results.filter((row) => row.passed).length;
  return {
    ok: results.length > 0 && passed === results.length,
    passed,
    failed: results.length - passed,
    results,
    diff: diffLiveVsBaseline(baseline, live),
  };
}
