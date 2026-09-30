import { describe, expect, it, vi } from "vitest";
import {
  scoreEvalCaseAgainstTranscript,
  scoreTranscriptEvalFile,
  diffLiveVsBaseline,
  invokeAgentForEval,
  scoreLiveReplay,
  transcriptRunFromLiveInvoke,
} from "./fluxy-eval";

describe("fluxy-eval", () => {
  it("requires listed tools on the matched run", () => {
    const pass = scoreEvalCaseAgainstTranscript(
      { status: "completed", tool_calls: [{ name: "search" }] },
      { requiredTools: ["search"] },
    );
    expect(pass.passed).toBe(true);
    const fail = scoreEvalCaseAgainstTranscript(
      { status: "completed", tool_calls: [{ name: "other" }] },
      { requiredTools: ["search"] },
    );
    expect(fail.passed).toBe(false);
  });

  it("scores a file by tag then index", () => {
    const report = scoreTranscriptEvalFile({
      cases: [
        { tag: "a", expectedOutputContains: "hello" },
        { tag: "b", requiredTools: ["calc"] },
      ],
      runs: [
        { tag: "a", status: "completed", output: "hello world" },
        { tag: "b", status: "completed", tool_calls: [{ name: "calc" }] },
      ],
    });
    expect(report.ok).toBe(true);
    expect(report.passed).toBe(2);
  });

  it("diffs tools and cost against a baseline run", () => {
    const diff = diffLiveVsBaseline(
      {
        id: "old",
        tool_calls: [{ name: "search" }],
        estimated_cost: 0.01,
        input_tokens: 10,
        output_tokens: 20,
      },
      {
        id: "new",
        tool_calls: [{ name: "search" }, { name: "web" }],
        estimated_cost: 0.04,
        input_tokens: 12,
        output_tokens: 40,
      },
    );
    expect(diff.sameTools).toBe(false);
    expect(diff.toolsAdded).toEqual(["web"]);
    expect(diff.costDelta).toBeCloseTo(0.03);
    expect(diff.outputTokenDelta).toBe(20);
  });

  it("scores a live run and attaches the baseline diff", () => {
    const report = scoreLiveReplay(
      {
        cases: [{ requiredTools: ["search"] }],
        runs: [{ id: "old", tool_calls: [{ name: "search" }], estimated_cost: 1 }],
      },
      { status: "completed", tool_calls: [{ name: "search" }], estimated_cost: 2 },
    );
    expect(report.ok).toBe(true);
    expect(report.diff.costDelta).toBe(1);
  });

  it("POSTs stream:false to invoke", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(
        JSON.stringify({
          run: { id: "r1", status: "completed", toolCalls: [{ name: "search" }] },
          message: { content: "ok" },
        }),
        { status: 200 },
      ),
    ) as unknown as typeof fetch;
    const live = await invokeAgentForEval({
      workerUrl: "https://worker.example/",
      token: "jwt",
      agentId: "bot",
      roomId: "room",
      prompt: "hi",
      fetchImpl,
    });
    expect(transcriptRunFromLiveInvoke(live).output).toBe("ok");
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://worker.example/agents/bot/invoke",
      expect.objectContaining({
        method: "POST",
      }),
    );
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      roomId: "room",
      content: "hi",
      stream: false,
    });
  });
});
