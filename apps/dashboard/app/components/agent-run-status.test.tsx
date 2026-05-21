import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentRunStatus } from "./agent-run-status";

describe("AgentRunStatus", () => {
  it("renders tool calls from run", () => {
    render(
      <AgentRunStatus
        run={{
          id: "run-1",
          status: "completed",
          latency_ms: 200,
          tool_calls: [
            { id: "tc1", name: "search_docs", arguments: '{"q":"fluxy"}' },
          ],
        }}
      />,
    );
    expect(screen.getByTestId("agent-tool-calls")).toBeInTheDocument();
    expect(screen.getByText("search_docs")).toBeInTheDocument();
  });
});
