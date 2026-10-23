import { describe, expect, it } from "vitest";
import {
  createRoomBookmark,
  deleteRoomBookmark,
  listRoomBookmarks,
} from "./room-bookmarks.js";

function createEnv(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                async run() {
                  if (sql.includes("INSERT INTO room_bookmarks")) {
                    rows.push({
                      id: args[0],
                      project_id: args[1],
                      room_id: args[2],
                      label: args[3],
                      url: args[4],
                      position: args[5],
                      created_by: args[6],
                      created_at: args[7],
                    });
                  } else if (sql.includes("DELETE FROM room_bookmarks")) {
                    const [id, projectId, roomId] = args;
                    for (let i = rows.length - 1; i >= 0; i -= 1) {
                      const row = rows[i];
                      if (row.id === id && row.project_id === projectId && row.room_id === roomId) {
                        rows.splice(i, 1);
                      }
                    }
                  }
                  return { meta: {} };
                },
                async first() {
                  if (sql.includes("COUNT(*)")) {
                    return {
                      c: rows.filter((row) => row.project_id === args[0] && row.room_id === args[1])
                        .length,
                    };
                  }
                  if (sql.includes("SELECT id, created_by")) {
                    return (
                      rows.find(
                        (row) => row.id === args[0] && row.project_id === args[1] && row.room_id === args[2],
                      ) || null
                    );
                  }
                  return null;
                },
                async all() {
                  return {
                    results: rows
                      .filter((row) => row.project_id === args[0] && row.room_id === args[1])
                      .map((row) => ({
                        id: row.id,
                        label: row.label,
                        url: row.url,
                        position: row.position,
                        created_by: row.created_by,
                        created_at: row.created_at,
                      })),
                  };
                },
              };
            },
          };
        },
      },
    },
  };
}

describe("room-bookmarks", () => {
  it("validates label and url", async () => {
    const { env } = createEnv();
    expect(
      (await createRoomBookmark(env, { projectId: "p1", roomId: "r1", label: "  ", url: "https://a.b" }))
        .error,
    ).toBe("label_required");
    expect(
      (await createRoomBookmark(env, { projectId: "p1", roomId: "r1", label: "Docs", url: "notaurl" }))
        .error,
    ).toBe("invalid_bookmark_url");
  });

  it("creates, lists in position order, and enforces delete permission", async () => {
    const { env } = createEnv();
    const first = await createRoomBookmark(env, {
      projectId: "p1",
      roomId: "r1",
      label: "Docs",
      url: "https://docs.example.com",
      createdBy: "u1",
    });
    const second = await createRoomBookmark(env, {
      projectId: "p1",
      roomId: "r1",
      label: "Runbook",
      url: "https://runbook.example.com",
      createdBy: "u2",
    });
    expect(first.bookmark.position).toBe(0);
    expect(second.bookmark.position).toBe(1);

    const list = await listRoomBookmarks(env, { projectId: "p1", roomId: "r1" });
    expect(list.bookmarks.map((b) => b.label)).toEqual(["Docs", "Runbook"]);

    expect(
      (await deleteRoomBookmark(env, { projectId: "p1", roomId: "r1", id: first.bookmark.id, actorUserId: "u3" }))
        .status,
    ).toBe(403);
    expect(
      (await deleteRoomBookmark(env, {
        projectId: "p1",
        roomId: "r1",
        id: second.bookmark.id,
        actorUserId: "u3",
        privileged: true,
      })).ok,
    ).toBe(true);
    expect(
      (await deleteRoomBookmark(env, { projectId: "p1", roomId: "r1", id: "missing", actorUserId: "u1" }))
        .status,
    ).toBe(404);
  });
});
