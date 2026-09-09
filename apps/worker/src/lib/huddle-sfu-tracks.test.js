import { describe, expect, it } from "vitest";
import {
  announceHuddleSfuTracks,
  listHuddleSfuTracks,
  sanitizeSfuSessionPayload,
  sanitizeSfuTracksPayload,
  withdrawHuddleSfuTracks,
} from "./huddle-sfu-tracks.js";

describe("huddle-sfu-tracks", () => {
  it("keeps a valid offer SDP and drops junk fields", () => {
    const out = sanitizeSfuSessionPayload({
      sessionDescription: { type: "offer", sdp: "v=0", extra: true },
      hack: 1,
    });
    expect(out).toEqual({
      sessionDescription: { type: "offer", sdp: "v=0" },
    });
  });

  it("rejects missing SDP", () => {
    expect(() => sanitizeSfuSessionPayload({})).toThrow(/sessionDescription/);
  });

  it("keeps local and remote track objects only", () => {
    const out = sanitizeSfuTracksPayload({
      sessionDescription: { type: "offer", sdp: "v=0" },
      tracks: [
        { location: "local", mid: "0", trackName: "mic-1", ignore: true },
        { location: "remote", sessionId: "abc", trackName: "cam-2" },
      ],
    });
    expect(out.tracks).toHaveLength(2);
    expect(out.tracks[0]).toEqual({ location: "local", mid: "0", trackName: "mic-1" });
    expect(out.tracks[1]).toEqual({
      location: "remote",
      sessionId: "abc",
      trackName: "cam-2",
    });
  });

  it("announces tracks then lists peers excluding self", async () => {
    const rows = [];
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("DELETE FROM huddle_sfu_tracks")) {
                    const [projectId, roomId, userId] = args;
                    for (let i = rows.length - 1; i >= 0; i--) {
                      if (
                        rows[i].project_id === projectId &&
                        rows[i].room_id === roomId &&
                        rows[i].user_id === userId
                      ) {
                        rows.splice(i, 1);
                      }
                    }
                  }
                  if (sql.includes("INSERT INTO huddle_sfu_tracks")) {
                    rows.push({
                      project_id: args[1],
                      room_id: args[2],
                      user_id: args[3],
                      session_id: args[4],
                      track_name: args[5],
                      kind: args[6],
                    });
                  }
                  return { meta: { changes: 1 } };
                },
                async all() {
                  const [projectId, roomId, userId] = args;
                  return {
                    results: rows.filter(
                      (r) =>
                        r.project_id === projectId &&
                        r.room_id === roomId &&
                        r.user_id !== userId,
                    ),
                  };
                },
              };
            },
          };
        },
      },
    };

    await announceHuddleSfuTracks(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "alice",
      sessionId: "ses_a",
      tracks: [{ trackName: "mic-a", kind: "audio" }],
    });
    await announceHuddleSfuTracks(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "bob",
      sessionId: "ses_b",
      tracks: [{ trackName: "mic-b", kind: "audio" }],
    });

    const listed = await listHuddleSfuTracks(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "alice",
    });
    expect(listed).toEqual([
      {
        project_id: "p1",
        room_id: "r1",
        user_id: "bob",
        session_id: "ses_b",
        track_name: "mic-b",
        kind: "audio",
      },
    ]);

    await withdrawHuddleSfuTracks(env, { projectId: "p1", roomId: "r1", userId: "bob" });
    const after = await listHuddleSfuTracks(env, {
      projectId: "p1",
      roomId: "r1",
      userId: "alice",
    });
    expect(after).toEqual([]);
  });
});
