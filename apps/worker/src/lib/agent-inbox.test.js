import { describe, expect, it } from "vitest";
import { askHumanTool, applyAgentInboxAction, hitlRowToInboxItem, mapLangGraphInterrupt, rankAgentInboxItems, withAskHumanTool } from "./agent-inbox.js";

describe("agent-inbox", () => {
  it("maps LangGraph interrupt payloads to question/review/notify", () => {
    const mapped = mapLangGraphInterrupt({
      ns: "agent:0",
      value: { type: "review", prompt: "Ship the patch?" },
    });
    expect(mapped.ok).toBe(true);
    expect(mapped.interrupt.kind).toBe("review");
  });

  it("askHuman pauses the run", () => {
    const out = askHumanTool({ prompt: "Can I post to Slack?", kind: "review", runId: "run-1" });
    expect(out.pause).toBe(true);
    expect(out.toolName).toBe("askHuman");
  });

  it("accept / reply / ignore", () => {
    const item = { status: "pending", interrupt: { resumeValue: "ok" } };
    expect(applyAgentInboxAction(item, "accept").status).toBe("accepted");
    expect(applyAgentInboxAction(item, "ignore").status).toBe("ignored");
    expect(applyAgentInboxAction(item, "reply", { reply: "use the staging hook" }).resume).toBe("use the staging hook");
  });

  it("maps a HITL row to a review inbox item", () => {
    const item = hitlRowToInboxItem({
      id: "h1",
      roomId: "r1",
      status: "pending",
      toolName: "http_request",
      runId: "run-9",
    });
    expect(item.kind).toBe("review");
    expect(item.interrupt.runId).toBe("run-9");
  });

  it("ranks by priority then due date", () => {
    const ranked = rankAgentInboxItems([
      { id: "b", priority: 1, dueAt: "2026-10-04T00:00:00Z", createdAt: "2" },
      { id: "a", priority: 2, dueAt: "2026-10-05T00:00:00Z", createdAt: "1" },
    ]);
    expect(ranked[0].id).toBe("a");
  });

  it("injects askHuman into the OpenAI tool list once", () => {
    const once = withAskHumanTool([]);
    expect(once.some((t) => t.function.name === "askHuman")).toBe(true);
    expect(withAskHumanTool(once)).toHaveLength(once.length);
  });
});
