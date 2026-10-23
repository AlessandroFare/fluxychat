import { describe, expect, it, vi } from "vitest";
import { invokeMentionedAgents } from "./agent-runtime.js";

const state = vi.hoisted(() => ({ reserveCalls: [] }));

vi.mock("./agent-budget.js", () => ({
  checkRoomAgentBudget: vi.fn(async () => ({
    allowed: true,
    usedTokens: 0,
    budget: 100_000,
    remaining: 100_000,
    monthKey: "2026-10",
  })),
  tryReserveRoomAgentTokens: vi.fn(async (_env, _projectId, _roomId, hold, monthKey) => {
    state.reserveCalls.push({ hold, monthKey });
    return { ok: true, held: hold };
  }),
  releaseRoomAgentTokens: vi.fn(async () => {}),
}));

function fakeEnv() {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            void sql;
            void params;
            return {
              first: async () => null,
              all: async () => ({ results: [] }),
              run: async () => ({ meta: { changes: 1 } }),
            };
          },
        };
      },
    },
  };
}

describe("invokeMentionedAgents budget hold (M5)", () => {
  it("M5: reserves a per-invoke estimate, not the whole remaining budget", async () => {
    state.reserveCalls.length = 0;
    await invokeMentionedAgents(
      fakeEnv(),
      "p1",
      "room-1",
      "user-1",
      "hey @bot_ada",
      ["@bot_ada"],
      "trace-1",
    );
    expect(state.reserveCalls).toEqual([{ hold: 1024, monthKey: "2026-10" }]);
  });
});
