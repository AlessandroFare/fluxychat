import { describe, expect, it } from "vitest";
import {
  buildAgentWorkspaceSteps,
  isAgentWorkspaceLive,
  agentWorkspaceStepsToUiParts,
  toolCategory,
  toolLabel,
} from "./agent-workspace";

describe("agent-workspace", () => {
  it("maps tool names to labels and categories", () => {
    expect(toolLabel("web_search")).toBe("Searching the web");
    expect(toolCategory("web_search")).toBe("search");
    expect(toolLabel("custom_thing")).toBe("Calling custom thing");
  });

  it("merges call and result into one completed step", () => {
    const steps = buildAgentWorkspaceSteps([
      {
        key: "r1:tc1:call",
        kind: "tool_call",
        runId: "r1",
        toolCallId: "tc1",
        name: "web_search",
        arguments: '{"q":"fluxy"}',
      },
      {
        key: "r1:tc1:result",
        kind: "tool_result",
        runId: "r1",
        toolCallId: "tc1",
        name: "web_search",
        resultPreview: '{"hits":2}',
      },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].status).toBe("completed");
    expect(steps[0].label).toBe("Searching the web");
    expect(steps[0].resultPreview).toBe('{"hits":2}');
  });

  it("marks tool_error as failed", () => {
    const steps = buildAgentWorkspaceSteps([
      {
        key: "r1:tc1:call",
        kind: "tool_call",
        runId: "r1",
        toolCallId: "tc1",
        name: "run_code",
        arguments: "{}",
      },
      {
        key: "r1:tc1:error",
        kind: "tool_error",
        runId: "r1",
        toolCallId: "tc1",
        name: "run_code",
        error: "timeout",
      },
    ]);
    expect(steps[0].status).toBe("failed");
    expect(steps[0].error).toBe("timeout");
  });

  it("prepends thinking step when agent busy with no tools yet", () => {
    const steps = buildAgentWorkspaceSteps([], {
      agentTyping: true,
      agentName: "Helper",
    });
    expect(steps).toHaveLength(1);
    expect(steps[0].category).toBe("thinking");
    expect(steps[0].label).toContain("Helper");
  });

  it("detects live workspace", () => {
    expect(isAgentWorkspaceLive([], { runPending: true })).toBe(true);
    expect(
      isAgentWorkspaceLive(
        [
          {
            id: "1",
            runId: "r",
            toolName: "x",
            label: "x",
            status: "completed",
            category: "generic",
          },
        ],
        {},
      ),
    ).toBe(false);
  });

  it("nests child tool events under the parent run_agent call", () => {
    const steps = buildAgentWorkspaceSteps([
      {
        key: "p:run:call",
        kind: "tool_call",
        runId: "parent",
        toolCallId: "run",
        name: "run_agent",
        arguments: '{"handle":"@researcher","prompt":"go"}',
      },
      {
        key: "c:search:call",
        kind: "tool_call",
        runId: "child",
        toolCallId: "search",
        name: "web_search",
        parentToolCallId: "run",
        nestDepth: 1,
      },
      {
        key: "c:search:result",
        kind: "tool_result",
        runId: "child",
        toolCallId: "search",
        name: "web_search",
        resultPreview: '{"hits":1}',
        parentToolCallId: "run",
        nestDepth: 1,
      },
      {
        key: "p:run:result",
        kind: "tool_result",
        runId: "parent",
        toolCallId: "run",
        name: "run_agent",
        resultPreview: '{"content":"ok"}',
      },
    ]);
    expect(steps).toHaveLength(1);
    expect(steps[0].toolName).toBe("run_agent");
    expect(steps[0].children).toHaveLength(1);
    expect(steps[0].children?.[0].toolName).toBe("web_search");
    expect(steps[0].children?.[0].status).toBe("completed");
    expect(isAgentWorkspaceLive(steps)).toBe(false);
  });

  it("maps completed steps to AG-UI tool parts", () => {
    const parts = agentWorkspaceStepsToUiParts([
      {
        id: "tc1",
        runId: "r1",
        toolName: "web_search",
        label: "Searching",
        status: "completed",
        category: "search",
        argsPreview: '{"q":"fluxy"}',
        resultPreview: '{"hits":1}',
      },
    ]);
    expect(parts.length).toBeGreaterThanOrEqual(2);
    expect(parts[0].type).toContain("tool");
  });
});
