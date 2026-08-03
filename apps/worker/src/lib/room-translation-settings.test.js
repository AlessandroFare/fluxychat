import { describe, expect, it } from "vitest";
import {
  getRoomTranslationSettings,
  upsertRoomTranslationSettings,
} from "./room-translation-settings.js";

function mockDb(rows = new Map()) {
  return {
    DB: {
      prepare(sql) {
        return {
          bind(...params) {
            return {
              async first() {
                if (sql.includes("FROM room_translation_settings")) {
                  const key = `${params[0]}:${params[1]}`;
                  return rows.get(key) ?? null;
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO room_translation_settings")) {
                  const key = `${params[0]}:${params[1]}`;
                  rows.set(key, {
                    project_id: params[0],
                    room_id: params[1],
                    enabled: params[2],
                    auto_translate_target: params[3],
                    updated_at: params[4],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}

describe("room-translation-settings", () => {
  it("defaults to disabled when unset", async () => {
    const env = mockDb();
    const settings = await getRoomTranslationSettings(env, "p1", "room-a");
    expect(settings.enabled).toBe(false);
    expect(settings.autoTranslateTarget).toBeNull();
  });

  it("upserts enabled room with target lang", async () => {
    const rows = new Map();
    const env = mockDb(rows);
    const result = await upsertRoomTranslationSettings(env, "p1", "room-a", {
      enabled: true,
      autoTranslateTarget: "es",
    });
    expect(result.ok).toBe(true);
    expect(result.settings.enabled).toBe(true);
    expect(result.settings.autoTranslateTarget).toBe("es");
  });

  it("rejects enabled without target", async () => {
    const env = mockDb();
    const result = await upsertRoomTranslationSettings(env, "p1", "room-a", { enabled: true });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("auto_translate_target_required");
  });
});
