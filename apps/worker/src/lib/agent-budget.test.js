/**
 * F2 agent budget circuit breaker — tests.
 *
 * The promise being pinned: once a room's monthly token cap is reached, agent
 * invocations are rejected BEFORE any LLM call happens, and the room is told
 * why (agent_budget_exceeded event). Uncapped rooms are untouched.
 */
import { describe, expect, it } from "vitest";
import {
  currentMonthKey,
  isValidMonthKey,
  evaluateBudget,
  setRoomAgentBudget,
  getRoomAgentBudget,
  getRoomMonthlyTokenUsage,
  checkRoomAgentBudget,
  tryReserveRoomAgentTokens,
} from "./agent-budget.js";
import { invokeMentionedAgents } from "./agent-runtime.js";

describe("agent-budget — pure policy", () => {
  it("month key format is YYYY-MM (UTC)", () => {
    const k = currentMonthKey(new Date(Date.UTC(2026, 7, 24)));
    expect(k).toBe("2026-08");
    expect(isValidMonthKey(k)).toBe(true);
    expect(isValidMonthKey("2026-8")).toBe(false);
    expect(isValidMonthKey("nope")).toBe(false);
  });

  it("uncapped rooms are always allowed (default-off)", () => {
    expect(evaluateBudget({ usedTokens: 5_000_000, monthlyTokenBudget: null, enabled: true })).toMatchObject({
      allowed: true,
      remaining: null,
    });
    expect(evaluateBudget({ usedTokens: 1, monthlyTokenBudget: undefined, enabled: true }).allowed).toBe(true);
  });

  it("disabled gate does not block even with a configured cap", () => {
    const d = evaluateBudget({ usedTokens: 999_999, monthlyTokenBudget: 1000, enabled: false });
    expect(d.allowed).toBe(true);
  });

  it("blocks only when usage has reached the cap", () => {
    const atLimit = evaluateBudget({ usedTokens: 1000, monthlyTokenBudget: 1000, enabled: true });
    expect(atLimit.allowed).toBe(false);
    expect(atLimit.reason).toBe("room_agent_budget_exhausted");
    expect(atLimit.remaining).toBe(0);

    const justUnder = evaluateBudget({ usedTokens: 999, monthlyTokenBudget: 1000, enabled: true });
    expect(justUnder.allowed).toBe(true);
    expect(justUnder.remaining).toBe(1);
  });

  it("fractional or negative budgets are floored; negative usage clamps to 0", () => {
    expect(evaluateBudget({ usedTokens: 0, monthlyTokenBudget: 99.9, enabled: true }).budget).toBe(99);
    expect(evaluateBudget({ usedTokens: -50, monthlyTokenBudget: 10, enabled: true }).usedTokens).toBe(0);
  });
});

/** D1 fake covering exactly the statements agent-budget.js and the gate use. */
function makeDb({ runs = [], configRow = null } = {}) {
  const state = { configRow, runs, statements: [], botResults: [] };

  const DB = {
    prepare(sql) {
      state.statements.push(sql);
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("FROM room_agent_budgets")) {
                return state.configRow;
              }
              if (sql.includes("SUM(COALESCE(input_tokens")) {
                const [projectId, roomId, likePattern] = params;
                // Bind arrives as a LIKE pattern ("2026-08-%"); match real
                // ISO strings by the literal year-month part.
                const ym = String(likePattern).replace(/%+$/, "");
                const used = state.runs
                  .filter(
                    (r) =>
                      r.project_id === projectId &&
                      r.room_id === roomId &&
                      String(r.created_at).startsWith(ym),
                  )
                  .reduce((acc, r) => acc + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
                return { used };
              }
              return null;
            },
            async run() {
              if (sql.includes("INSERT INTO room_agent_budgets")) {
                state.configRow = {
                  project_id: params[0],
                  room_id: params[1],
                  monthly_token_budget: params[2],
                  enabled: params[3],
                  updated_at: params[4],
                  inflight_tokens: state.configRow?.inflight_tokens || 0,
                };
              }
              if (sql.includes("SET inflight_tokens = COALESCE")) {
                const hold = Number(params[0]) || 0;
                const used = (state.runs || [])
                  .filter(
                    (r) =>
                      r.project_id === params[1] &&
                      r.room_id === params[2],
                  )
                  .reduce((acc, r) => acc + (r.input_tokens || 0) + (r.output_tokens || 0), 0);
                const inflight = Number(state.configRow?.inflight_tokens) || 0;
                const budget = Number(state.configRow?.monthly_token_budget) || 0;
                const enabled = Number(state.configRow?.enabled) === 1;
                if (enabled && budget > 0 && inflight + hold + used <= budget) {
                  state.configRow = {
                    ...state.configRow,
                    inflight_tokens: inflight + hold,
                  };
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              if (sql.includes("SET inflight_tokens = MAX")) {
                const hold = Number(params[0]) || 0;
                const inflight = Number(state.configRow?.inflight_tokens) || 0;
                if (state.configRow) {
                  state.configRow.inflight_tokens = Math.max(0, inflight - hold);
                }
              }
              return { meta: { changes: 1 } };
            },
            async all() {
              if (sql.includes("FROM bots WHERE project_id")) {
                return { results: state.botResults };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };

  return { DB, state };
}

describe("agent-budget — storage round-trip", () => {
  it("setRoomAgentBudget upserts and getRoomAgentBudget reads it back", async () => {
    const { DB, state } = makeDb();
    await setRoomAgentBudget({ DB }, "p1", "room-a", { monthlyTokenBudget: 25_000, enabled: true });

    const row = await getRoomAgentBudget({ DB }, "p1", "room-a");
    expect(row.monthly_token_budget).toBe(25000);
    expect(Number(row.enabled)).toBe(1);
  });

  it("setting a zero/negative budget clears the cap", async () => {
    const { DB, state } = makeDb();
    await setRoomAgentBudget({ DB }, "p1", "room-b", { monthlyTokenBudget: 5000, enabled: true });
    const cleared = await setRoomAgentBudget({ DB }, "p1", "room-b", { monthlyTokenBudget: -3, enabled: false });
    expect(cleared.monthlyTokenBudget).toBeNull();
    expect(cleared.enabled).toBe(false);
  });

  it("getRoomMonthlyTokenUsage sums input+output for the month only", async () => {
    const { DB, state } = makeDb();
    state.runs.push(
      { project_id: "p1", room_id: "r1", input_tokens: 100, output_tokens: 50, created_at: "2026-08-01T00:00:00Z" },
      { project_id: "p1", room_id: "r1", input_tokens: 200, output_tokens: 30, created_at: "2026-08-15T00:00:00Z" },
      // Other month / other room / other tenant must be excluded:
      { project_id: "p1", room_id: "r1", input_tokens: 999, output_tokens: 999, created_at: "2026-07-31T23:59:59Z" },
      { project_id: "p1", room_id: "r2", input_tokens: 999, output_tokens: 999, created_at: "2026-08-02T00:00:00Z" },
      { project_id: "pX", room_id: "r1", input_tokens: 999, output_tokens: 999, created_at: "2026-08-02T00:00:00Z" },
    );
    const used = await getRoomMonthlyTokenUsage({ DB }, "p1", "r1", "2026-08");
    expect(used).toBe(380); // 150 + 230
  });

  it("checkRoomAgentBudget combines config + usage into a decision", async () => {
    const { DB, state } = makeDb();
    state.configRow = { monthly_token_budget: 300, enabled: 1 };
    state.runs.push(
      { project_id: "p1", room_id: "r1", input_tokens: 250, output_tokens: 60, created_at: `${currentMonthKey()}-01T00:00:00Z` },
    );

    const decision = await checkRoomAgentBudget({ DB }, "p1", "r1");
    expect(decision.allowed).toBe(false);
    expect(decision.usedTokens).toBe(310);
    expect(decision.budget).toBe(300);
    expect(decision.reason).toBe("room_agent_budget_exhausted");
  });

  it("tryReserveRoomAgentTokens refuses a second hold that would exceed the cap", async () => {
    const { DB, state } = makeDb();
    state.configRow = {
      monthly_token_budget: 100,
      enabled: 1,
      inflight_tokens: 0,
    };
    state.runs = [
      {
        project_id: "p1",
        room_id: "r1",
        input_tokens: 90,
        output_tokens: 0,
        created_at: `${currentMonthKey()}-01T00:00:00Z`,
      },
    ];
    const first = await tryReserveRoomAgentTokens({ DB }, "p1", "r1", 10, currentMonthKey());
    expect(first.ok).toBe(true);
    const second = await tryReserveRoomAgentTokens({ DB }, "p1", "r1", 10, currentMonthKey());
    expect(second.ok).toBe(false);
  });
});

describe("agent-budget — the gate inside invokeMentionedAgents", () => {
  it("blocked room: no bot query, no LLM call, budget event announced", async () => {
    const { DB, state } = makeDb();
    state.configRow = { monthly_token_budget: 100, enabled: 1 };
    state.runs.push({
      project_id: "p1",
      room_id: "room-gate",
      input_tokens: 80,
      output_tokens: 40,
      created_at: `${currentMonthKey()}-02T00:00:00Z`,
    });

    const announced = [];
    const env = {
      DB,
      ROOM: {
        idFromName: (name) => `do:${name}`,
        get: () => ({
          async fetch(url, init) {
            announced.push({ url, body: JSON.parse(init.body) });
            return new Response("{}", { status: 200 });
          },
        }),
      },
    };

    // Should return silently after the gate, never reaching the bots SELECT.
    await invokeMentionedAgents(env, "p1", "room-gate", "user-1", "hello @bot", ["@bot"], null);

    const botQueries = (state.statements || []).filter((s) => s.includes("FROM bots"));
    expect(botQueries.length).toBe(0);

    const typing = announced.find((a) => a.body.type === "agentTyping");
    expect(typing).toBeUndefined();
    const exceeded = announced.find((a) => a.body.type === "agent_budget_exceeded");
    expect(exceeded).toBeDefined();
    expect(exceeded.body.usedTokens).toBe(120);
    expect(exceeded.body.budget).toBe(100);
  });

  it("uncapped room passes the gate and proceeds to the bots query", async () => {
    const { DB, state } = makeDb();
    state.configRow = null; // no budget configured

    const env = {
      DB,
      ROOM: {
        idFromName: (name) => `do:${name}`,
        get: () => ({
          async fetch() {
            return new Response("{}", { status: 200 });
          },
        }),
      },
    };

    await invokeMentionedAgents(env, "p1", "room-open", "user-1", "hello @nobody", ["@nobody"], null);

    const botQueries = (state.statements || []).filter((s) => s.includes("FROM bots"));
    expect(botQueries.length).toBe(1);
  });
});
