import { describe, expect, it } from "vitest";
import {
  agentDoName,
  appendCopilotTurn,
  copilotThreadId,
  MAX_COPILOT_TURNS,
  serializeCopilotState,
} from "./agent-do-session.js";

describe("agent DO session helpers", () => {
  it("names the isolate per project+agent+user", () => {
    expect(agentDoName("p1", "bot", "u1")).toBe("p1__bot__u1");
    expect(copilotThreadId("bot", "u1")).toBe("copilot:bot:u1");
  });

  it("caps stored turns", () => {
    let turns = [];
    for (let i = 0; i < MAX_COPILOT_TURNS + 5; i++) {
      turns = appendCopilotTurn(turns, { role: "user", content: String(i) }, i);
    }
    expect(turns).toHaveLength(MAX_COPILOT_TURNS);
    expect(turns[0].content).toBe("5");
  });

  it("serializes state", () => {
    const out = serializeCopilotState({
      meta: { projectId: "p", agentId: "a", userId: "u", threadId: "copilot:a:u" },
      turns: [{ role: "user", content: "hi" }],
    });
    expect(out.turnCount).toBe(1);
    expect(out.agentId).toBe("a");
  });
});
