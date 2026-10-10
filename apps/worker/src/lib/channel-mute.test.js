import { describe, expect, it } from "vitest";
import {
  clearChannelMute,
  getChannelMute,
  isChannelMuted,
  muteIsActive,
  upsertChannelMute,
} from "./channel-mute.js";

function createEnv() {
  const rows = [];
  return {
    rows,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO room_channel_mutes")) {
                    const [projectId, userId, roomId, mutedUntil, createdAt] = args;
                    const i = rows.findIndex(
                      (r) =>
                        r.project_id === projectId &&
                        r.user_id === userId &&
                        r.room_id === roomId,
                    );
                    const next = {
                      project_id: projectId,
                      user_id: userId,
                      room_id: roomId,
                      muted_until: mutedUntil,
                      created_at: createdAt,
                    };
                    if (i >= 0) rows[i] = { ...rows[i], ...next };
                    else rows.push(next);
                  } else if (sql.includes("DELETE FROM room_channel_mutes")) {
                    const keep = rows.filter(
                      (r) =>
                        !(
                          r.project_id === args[0] &&
                          r.user_id === args[1] &&
                          r.room_id === args[2]
                        ),
                    );
                    rows.length = 0;
                    rows.push(...keep);
                  }
                },
                async first() {
                  if (!sql.includes("FROM room_channel_mutes")) return null;
                  return (
                    rows.find(
                      (r) =>
                        r.project_id === args[0] &&
                        r.user_id === args[1] &&
                        r.room_id === args[2],
                    ) || null
                  );
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("channel-mute", () => {
  it("muteIsActive is true until expiration", () => {
    expect(muteIsActive(null)).toBe(false);
    expect(muteIsActive({ muted_until: null })).toBe(true);
    expect(muteIsActive({ muted_until: "2099-01-01T00:00:00.000Z" })).toBe(true);
    expect(muteIsActive({ muted_until: "2000-01-01T00:00:00.000Z" })).toBe(false);
  });

  it("upserts indefinite mute and clears it", async () => {
    const { env } = createEnv();
    const put = await upsertChannelMute(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "r1",
      mutedUntil: null,
    });
    expect(put.ok).toBe(true);
    expect(await isChannelMuted(env, { projectId: "p1", userId: "u1", roomId: "r1" })).toBe(true);
    await clearChannelMute(env, { projectId: "p1", userId: "u1", roomId: "r1" });
    expect(await getChannelMute(env, { projectId: "p1", userId: "u1", roomId: "r1" })).toEqual({
      muted: false,
    });
  });

  it("rejects invalid muted_until", async () => {
    const { env } = createEnv();
    const result = await upsertChannelMute(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "r1",
      mutedUntil: "not-a-date",
    });
    expect(result.ok).toBe(false);
  });
});
