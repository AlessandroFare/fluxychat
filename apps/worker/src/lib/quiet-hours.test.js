import { describe, expect, it } from "vitest";
import {
  getLocalMinutesSinceMidnight,
  isInQuietHours,
  isValidTimezone,
  parseHm,
  upsertQuietHoursPreferences,
} from "./quiet-hours.js";

describe("quiet-hours", () => {
  it("parseHm accepts HH:MM", () => {
    expect(parseHm("22:00")).toBe(22 * 60);
    expect(parseHm("07:30")).toBe(7 * 60 + 30);
    expect(parseHm("25:00")).toBeNull();
  });

  it("isValidTimezone accepts IANA zones", () => {
    expect(isValidTimezone("Europe/Rome")).toBe(true);
    expect(isValidTimezone("Not/AZone")).toBe(false);
  });

  it("isInQuietHours handles same-day window", () => {
    const prefs = {
      enabled: true,
      timezone: "UTC",
      quietStart: "09:00",
      quietEnd: "17:00",
    };
    const morning = new Date("2026-06-08T08:30:00.000Z");
    const noon = new Date("2026-06-08T12:00:00.000Z");
    expect(isInQuietHours(prefs, morning)).toBe(false);
    expect(isInQuietHours(prefs, noon)).toBe(true);
  });

  it("isInQuietHours handles overnight window", () => {
    const prefs = {
      enabled: true,
      timezone: "UTC",
      quietStart: "22:00",
      quietEnd: "07:00",
    };
    const late = new Date("2026-06-08T23:00:00.000Z");
    const early = new Date("2026-06-08T06:00:00.000Z");
    const midday = new Date("2026-06-08T12:00:00.000Z");
    expect(isInQuietHours(prefs, late)).toBe(true);
    expect(isInQuietHours(prefs, early)).toBe(true);
    expect(isInQuietHours(prefs, midday)).toBe(false);
  });

  it("getLocalMinutesSinceMidnight uses timezone", () => {
    const utcNoon = new Date("2026-06-08T12:00:00.000Z");
    expect(getLocalMinutesSinceMidnight(utcNoon, "UTC")).toBe(12 * 60);
  });

  it("upsertQuietHoursPreferences validates timezone", async () => {
    const env = createQuietEnv();
    const bad = await upsertQuietHoursPreferences(env, "proj_1", "user_1", {
      enabled: true,
      timezone: "Invalid/Zone",
    });
    expect(bad.ok).toBe(false);

    const ok = await upsertQuietHoursPreferences(env, "proj_1", "user_1", {
      enabled: true,
      timezone: "Europe/Rome",
      quietStart: "22:00",
      quietEnd: "07:00",
    });
    expect(ok.ok).toBe(true);
    expect(ok.preferences.timezone).toBe("Europe/Rome");
  });
});

function createQuietEnv() {
  const rows = [];
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("FROM user_quiet_hours")) {
                  return (
                    rows.find(
                      (r) => r.project_id === binds[0] && r.user_id === binds[1],
                    ) ?? null
                  );
                }
                return null;
              },
              run: async () => {
                if (sql.includes("INSERT INTO user_quiet_hours")) {
                  const existing = rows.findIndex(
                    (r) => r.project_id === binds[0] && r.user_id === binds[1],
                  );
                  const row = {
                    project_id: binds[0],
                    user_id: binds[1],
                    enabled: binds[2],
                    timezone: binds[3],
                    quiet_start: binds[4],
                    quiet_end: binds[5],
                    batch_push: binds[6],
                    batch_in_app: binds[7],
                    updated_at: binds[8],
                  };
                  if (existing >= 0) rows[existing] = row;
                  else rows.push(row);
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
}
