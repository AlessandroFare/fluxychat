import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import {
  estimateHuddleBytes,
  monthUtcKey,
  settleHuddleSfuSession,
} from "./huddle-sfu-budget.js";

const DDL = `
CREATE TABLE huddle_sfu_meter (
  month_utc TEXT PRIMARY KEY,
  bytes_used INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE huddle_sfu_open (
  session_id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  has_video INTEGER NOT NULL DEFAULT 0,
  started_at TEXT NOT NULL
);
`;

function createEnv({ meterBytes = 0, sessions = [] } = {}) {
  const db = new DatabaseSync(":memory:");
  db.exec(DDL);
  if (meterBytes) {
    db.prepare("INSERT INTO huddle_sfu_meter (month_utc, bytes_used) VALUES (?, ?)").run(
      monthUtcKey(),
      meterBytes,
    );
  }
  for (const s of sessions) {
    db.prepare(
      "INSERT INTO huddle_sfu_open (session_id, project_id, room_id, user_id, has_video, started_at) VALUES (?, ?, ?, ?, ?, ?)",
    ).run(s.session_id, "p1", "r1", "u1", 0, s.started_at);
  }
  const writes = { meter: 0 };
  const env = {
    DB: {
      prepare(sql) {
        const execFor = (args) => ({
          first: async () => db.prepare(sql).get(...args) ?? null,
          all: async () => ({ results: db.prepare(sql).all(...args) }),
          run: async () => {
            if (sql.includes("huddle_sfu_meter") && !sql.trimStart().startsWith("SELECT")) {
              writes.meter += 1;
            }
            const res = db.prepare(sql).run(...args);
            return { meta: { changes: res.changes, last_row_id: Number(res.lastInsertRowid) } };
          },
        });
        return { bind: (...args) => execFor(args), ...execFor([]) };
      },
    },
  };
  return { env, db, writes };
}

describe("huddle SFU meter concurrency (M6/M8)", () => {
  it("M6: concurrent settles accumulate both charges on the month meter", async () => {
    const started = new Date(Date.now() - 60_000).toISOString();
    const { env, db } = createEnv({
      meterBytes: 1000,
      sessions: [
        { session_id: "ses_a", started_at: started },
        { session_id: "ses_b", started_at: started },
      ],
    });

    await Promise.all([
      settleHuddleSfuSession(env, { sessionId: "ses_a" }),
      settleHuddleSfuSession(env, { sessionId: "ses_b" }),
    ]);

    const minBytes = estimateHuddleBytes({ durationMs: 60_000, hasVideo: false, peerCount: 2 });
    const meter = db
      .prepare("SELECT bytes_used FROM huddle_sfu_meter WHERE month_utc = ?")
      .get(monthUtcKey());
    expect(meter.bytes_used).toBeGreaterThanOrEqual(1000 + 2 * minBytes);
  });

  it("M8: a settled session is charged once even under concurrent settles", async () => {
    const started = new Date(Date.now() - 60_000).toISOString();
    const { env, writes } = createEnv({
      meterBytes: 1000,
      sessions: [{ session_id: "ses_a", started_at: started }],
    });

    await Promise.all([
      settleHuddleSfuSession(env, { sessionId: "ses_a" }),
      settleHuddleSfuSession(env, { sessionId: "ses_a" }),
    ]);

    expect(writes.meter).toBe(1);
  });
});
