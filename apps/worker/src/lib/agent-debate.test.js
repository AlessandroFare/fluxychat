import { describe, expect, it } from "vitest";
import {
  buildDebateMessages,
  mapDebateRoleRow,
  mapDebateSessionRow,
} from "./agent-debate.js";

describe("agent-debate", () => {
  it("maps debate role row", () => {
    const role = mapDebateRoleRow({
      id: "drole_1",
      project_id: "p1",
      trigger_pattern: null,
      role_name: "Technical",
      system_prompt: "Be technical",
      max_rounds: 2,
      sort_order: 0,
      enabled: 1,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    expect(role?.roleName).toBe("Technical");
    expect(role?.enabled).toBe(true);
  });

  it("maps debate session row with steps", () => {
    const session = mapDebateSessionRow({
      id: "debate_1",
      project_id: "p1",
      room_id: "room1",
      prompt: "Should we migrate?",
      status: "completed",
      max_rounds: 1,
      current_round: 1,
      steps_json: JSON.stringify([{ roleName: "Risk", content: "Careful" }]),
      synthesis_content: "Proceed in phases.",
      latency_ms: 1200,
      created_at: "2026-08-01T00:00:00Z",
      completed_at: "2026-08-01T00:00:05Z",
    });
    expect(session?.steps).toHaveLength(1);
    expect(session?.synthesisContent).toBe("Proceed in phases.");
  });

  it("builds debate messages with prior steps", () => {
    const messages = buildDebateMessages(
      [{ roleName: "Technical", content: "Use queues", round: 1 }],
      "How should we scale?",
    );
    expect(messages[0].content).toBe("How should we scale?");
    expect(messages[1].content).toContain("Technical");
  });
});
