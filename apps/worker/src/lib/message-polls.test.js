import { describe, it, expect } from "vitest";
import { parsePollCreateInput, buildPollSnapshot, attachPollsToMessages } from "./message-polls.js";
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

  it("attachPollsToMessages adds poll with userVote", async () => {
    const pollRow = {
      message_id: 10,
      question: "Lunch?",
      options_json: '["Pizza","Sushi"]',
      allow_multiple: 0,
      closed: 0,
    };
    const env = {
      DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            all: () => {
              if (sql.includes("message_polls")) {
                return Promise.resolve({ results: [pollRow] });
              }
              if (sql.includes("GROUP BY message_id, option_index")) {
                return Promise.resolve({
                  results: [
                    { message_id: 10, option_index: 0, c: 2 },
                    { message_id: 10, option_index: 1, c: 1 },
                  ],
                });
              }
              if (sql.includes("COUNT(DISTINCT user_id)")) {
                return Promise.resolve({ results: [{ message_id: 10, c: 3 }] });
              }
              if (sql.includes("user_id = ?")) {
                return Promise.resolve({ results: [{ message_id: 10, option_index: 1 }] });
              }
              return Promise.resolve({ results: [] });
            },
          }),
        }),
      },
    };
    const messages = [{ id: 10, text: "poll msg" }, { id: 11, text: "plain" }];
    const out = await attachPollsToMessages(env, "p1", messages, "user-1");
    expect(out[0].poll).toBeDefined();
    expect(out[0].poll.userVote).toBe(1);
    expect(out[0].poll.options[0].votes).toBe(2);
    expect(out[1].poll).toBeUndefined();
  });
});

describe("user-blocks", () => {
  it("rejects self-block", async () => {
    const env = mockEnv();
    const r = await blockUser(env, "p1", "u1", "u1");
    expect(r.ok).toBe(false);
  });
});
