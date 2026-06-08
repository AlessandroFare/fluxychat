import { describe, it, expect } from "vitest";
import { parsePollCreateInput, buildPollSnapshot } from "./message-polls.js";
import { blockUser } from "./user-blocks.js";

function mockEnv() {
  const runs = [];
  return {
    runs,
    DB: {
      prepare: (sql) => ({
        bind: (...args) => ({
          run: () => {
            runs.push({ sql, args });
            return Promise.resolve({});
          },
          first: () => Promise.resolve(null),
          all: () => Promise.resolve({ results: [] }),
        }),
      }),
    },
  };
}

describe("message-polls", () => {
  it("parses valid poll input", () => {
    const r = parsePollCreateInput({
      question: "Lunch?",
      options: ["Pizza", "Sushi"],
      allowMultiple: false,
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.options).toEqual(["Pizza", "Sushi"]);
    }
  });

  it("rejects too few options", () => {
    const r = parsePollCreateInput({ question: "Q", options: ["only"] });
    expect(r.ok).toBe(false);
  });

  it("builds snapshot with vote counts", () => {
    const snap = buildPollSnapshot("Pick one", ["A", "B"], false, { 0: 3, 1: 1 }, 42, 4);
    expect(snap.options[0].votes).toBe(3);
    expect(snap.totalVoters).toBe(4);
  });
});

describe("user-blocks", () => {
  it("rejects self-block", async () => {
    const env = mockEnv();
    const r = await blockUser(env, "p1", "u1", "u1");
    expect(r.ok).toBe(false);
  });
});
