import { describe, expect, it } from "vitest";
import {
  DEFAULT_MONTHLY_GB_CAP,
  assertHuddleSfuBudget,
  estimateHuddleBytes,
  huddleSfuBudgetSnapshot,
  monthUtcKey,
  settleHuddleSfuSession,
} from "./huddle-sfu-budget.js";

function createEnv(opts = {}) {
  const open = opts.open || [];
  const meter = opts.meter || { month_utc: monthUtcKey(), bytes_used: 0 };
  return {
    REALTIME_SFU_DISABLED: opts.disabled,
    REALTIME_SFU_ALLOW_VIDEO: opts.allowVideo,
    REALTIME_SFU_MONTHLY_GB_CAP: opts.monthlyGb,
    REALTIME_SFU_MAX_CONCURRENT: opts.concurrent,
    REALTIME_SFU_MAX_SESSION_SECONDS: opts.maxSessionSeconds,
    DB: {
      prepare(sql) {
        const exec = {
          async first() {
            if (sql.includes("FROM huddle_sfu_open") && sql.includes("COUNT")) {
              return { n: open.length };
            }
            if (sql.includes("FROM huddle_sfu_meter")) {
              const month = monthUtcKey();
              return meter.month_utc === month || sql.includes("WHERE")
                ? meter
                : { month_utc: month, bytes_used: 0 };
            }
            if (sql.includes("FROM huddle_sfu_open") && sql.includes("session_id")) {
              return open[0] || null;
            }
            return null;
          },
          async all() {
            return { results: open.slice() };
          },
          async run() {
            if (sql.includes("INSERT INTO huddle_sfu_open")) {
              open.push({
                session_id: "ses_new",
                project_id: "p",
                room_id: "r",
                user_id: "u",
                has_video: 0,
                started_at: new Date().toISOString(),
              });
            }
            if (sql.includes("DELETE FROM huddle_sfu_open")) {
              open.splice(0, open.length);
            }
            if (sql.includes("INSERT INTO huddle_sfu_meter") || sql.includes("UPDATE huddle_sfu_meter")) {
              meter.bytes_used = Number(meter.bytes_used || 0) + 1;
            }
            return { meta: { changes: 1 } };
          },
        };
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM huddle_sfu_open") && sql.includes("COUNT")) {
                  return { n: open.length };
                }
                if (sql.includes("FROM huddle_sfu_meter")) {
                  return meter.month_utc === args[0]
                    ? meter
                    : { month_utc: args[0], bytes_used: meter.month_utc === args[0] ? meter.bytes_used : meter.bytes_used };
                }
                if (sql.includes("FROM huddle_sfu_open") && sql.includes("session_id")) {
                  return open.find((s) => s.session_id === args[0]) || null;
                }
                return null;
              },
              async all() {
                return { results: open.filter((s) => s.user_id === args[2] || s.session_id === args[0]) };
              },
              async run() {
                if (sql.includes("INSERT INTO huddle_sfu_open")) {
                  open.push({
                    session_id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    user_id: args[3],
                    has_video: args[4],
                    started_at: args[5],
                  });
                }
                if (sql.includes("DELETE FROM huddle_sfu_open")) {
                  const idx = open.findIndex((s) => s.session_id === args[0]);
                  if (idx >= 0) open.splice(idx, 1);
                }
                if (sql.includes("INSERT INTO huddle_sfu_meter")) {
                  meter.month_utc = args[0];
                  meter.bytes_used = Number(args[1]);
                }
                if (sql.includes("UPDATE huddle_sfu_meter")) {
                  meter.bytes_used = Number(args[0]);
                }
                return { meta: { changes: 1 } };
              },
            };
          },
          ...exec,
        };
      },
    },
  };
}

describe("huddle-sfu-budget", () => {
  it("estimates audio cheaper than video", () => {
    const audio = estimateHuddleBytes({ durationMs: 60_000, hasVideo: false, peerCount: 2 });
    const video = estimateHuddleBytes({ durationMs: 60_000, hasVideo: true, peerCount: 2 });
    expect(video).toBeGreaterThan(audio * 4);
    expect(audio).toBeGreaterThan(0);
  });

  it("defaults the monthly cap well under 1 TB", () => {
    expect(DEFAULT_MONTHLY_GB_CAP).toBeLessThanOrEqual(100);
  });

  it("blocks new sessions when the monthly estimate is exhausted", async () => {
    const env = createEnv({
      monthlyGb: 1,
      meter: { month_utc: monthUtcKey(), bytes_used: 2 * 1e9 },
    });
    const out = await assertHuddleSfuBudget(env, { hasVideo: false });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("monthly_gb");
  });

  it("blocks when too many huddles are already open", async () => {
    const env = createEnv({
      concurrent: 1,
      open: [
        {
          session_id: "ses_a",
          project_id: "p",
          room_id: "r",
          user_id: "u",
          has_video: 0,
          started_at: new Date().toISOString(),
        },
      ],
    });
    const out = await assertHuddleSfuBudget(env, { hasVideo: false });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("concurrent");
  });

  it("blocks video unless explicitly allowed", async () => {
    const env = createEnv({ allowVideo: "false" });
    const out = await assertHuddleSfuBudget(env, { hasVideo: true });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("video_disabled");
  });

  it("kill switch stops huddles", async () => {
    const env = createEnv({ disabled: "true" });
    const out = await assertHuddleSfuBudget(env, { hasVideo: false });
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("disabled");
  });

  it("charges an open session onto the monthly meter", async () => {
    const started = new Date(Date.now() - 60_000).toISOString();
    const env = createEnv({
      open: [
        {
          session_id: "ses_a",
          project_id: "p",
          room_id: "r",
          user_id: "u",
          has_video: 0,
          started_at: started,
        },
      ],
    });
    await settleHuddleSfuSession(env, { sessionId: "ses_a" });
    const snap = await huddleSfuBudgetSnapshot(env);
    expect(snap.bytesUsed).toBeGreaterThan(0);
    expect(snap.openSessions).toBe(0);
  });
});
