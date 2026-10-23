import { describe, expect, it } from "vitest";
import {
  createRoomFolder,
  deleteRoomFolder,
  listRoomFolders,
  removeRoomFolderItem,
  renameRoomFolder,
  setRoomFolderItem,
} from "./room-folders.js";

function createEnv(seedRooms = [{ id: "r1" }, { id: "r2" }]) {
  const folders = [];
  const items = [];

  const run = (sql, args) => {
    if (sql.includes("INSERT INTO room_folders")) {
      folders.push({
        id: args[0],
        project_id: args[1],
        user_id: args[2],
        name: args[3],
        position: args[4],
        created_at: args[5],
      });
    } else if (sql.includes("UPDATE room_folders SET name")) {
      const folder = folders.find(
        (f) => f.id === args[1] && f.project_id === args[2] && f.user_id === args[3],
      );
      if (folder) folder.name = args[0];
    } else if (sql.includes("DELETE FROM room_folders")) {
      const [folderId, projectId, userId] = args;
      const i = folders.findIndex(
        (f) => f.id === folderId && f.project_id === projectId && f.user_id === userId,
      );
      if (i >= 0) folders.splice(i, 1);
    } else if (sql.includes("DELETE FROM room_folder_items") && sql.includes("IN (SELECT")) {
      const [projectId, roomId, ownerProjectId, ownerUserId] = args;
      const owned = new Set(
        folders
          .filter((f) => f.project_id === ownerProjectId && f.user_id === ownerUserId)
          .map((f) => f.id),
      );
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (
          item.project_id === projectId &&
          item.room_id === roomId &&
          owned.has(item.folder_id)
        ) {
          items.splice(i, 1);
        }
      }
    } else if (sql.includes("DELETE FROM room_folder_items") && sql.includes("room_id = ?")) {
      const [folderId, projectId, roomId] = args;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (
          item.folder_id === folderId &&
          item.project_id === projectId &&
          item.room_id === roomId
        ) {
          items.splice(i, 1);
        }
      }
    } else if (sql.includes("DELETE FROM room_folder_items")) {
      const [folderId, projectId] = args;
      for (let i = items.length - 1; i >= 0; i -= 1) {
        const item = items[i];
        if (item.folder_id === folderId && item.project_id === projectId) {
          items.splice(i, 1);
        }
      }
    } else if (sql.includes("INSERT OR REPLACE INTO room_folder_items")) {
      const [folderId, projectId, roomId, createdAt] = args;
      if (!items.some((x) => x.folder_id === folderId && x.room_id === roomId)) {
        items.push({ folder_id: folderId, project_id: projectId, room_id: roomId, created_at: createdAt });
      }
    }
  };

  const one = (sql, args) => {
    if (sql.includes("COUNT(*)") && sql.includes("FROM room_folders")) {
      return {
        c: folders.filter((f) => f.project_id === args[0] && f.user_id === args[1]).length,
      };
    }
    if (sql.includes("FROM room_folders")) {
      return (
        folders.find(
          (f) => f.id === args[0] && f.project_id === args[1] && f.user_id === args[2],
        ) || null
      );
    }
    if (sql.includes("FROM rooms")) {
      return seedRooms.find((r) => r.id === args[0] && (args[1] ? true : true)) || null;
    }
    return null;
  };

  const many = (sql, args) => {
    if (sql.includes("FROM room_folder_items")) {
      const [projectId, ownerProjectId, ownerUserId] = args;
      const owned = new Set(
        folders
          .filter((f) => f.project_id === ownerProjectId && f.user_id === ownerUserId)
          .map((f) => f.id),
      );
      return items
        .filter((item) => item.project_id === projectId && owned.has(item.folder_id))
        .map((item) => ({ folder_id: item.folder_id, room_id: item.room_id }));
    }
    if (sql.includes("FROM room_folders")) {
      return folders
        .filter((f) => f.project_id === args[0] && f.user_id === args[1])
        .map((f) => ({ id: f.id, name: f.name, position: f.position, created_at: f.created_at }));
    }
    return [];
  };

  return {
    folders,
    items,
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...args) {
              return {
                sql,
                args,
                async run() {
                  run(sql, args);
                  return { meta: {} };
                },
                async first() {
                  return one(sql, args);
                },
                async all() {
                  return { results: many(sql, args) };
                },
              };
            },
          };
        },
        async batch(stmts) {
          for (const stmt of stmts) run(stmt.sql, stmt.args);
        },
      },
    },
  };
}

describe("room-folders", () => {
  it("validates names and lists empty folders", async () => {
    const { env } = createEnv();
    expect((await createRoomFolder(env, { projectId: "p1", userId: "u1", name: "  " })).error).toBe(
      "invalid_folder_name",
    );
    const created = await createRoomFolder(env, { projectId: "p1", userId: "u1", name: "  Work   stuff " });
    expect(created.ok).toBe(true);
    expect(created.folder.name).toBe("Work stuff");
    const list = await listRoomFolders(env, { projectId: "p1", userId: "u1" });
    expect(list.folders).toEqual([
      expect.objectContaining({ name: "Work stuff", roomIds: [] }),
    ]);
  });

  it("assigns a room to one folder at a time and 404s unknown folders/rooms", async () => {
    const { env, items } = createEnv();
    const a = (await createRoomFolder(env, { projectId: "p1", userId: "u1", name: "a" })).folder;
    const b = (await createRoomFolder(env, { projectId: "p1", userId: "u1", name: "b" })).folder;

    expect(
      (await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: "nope", roomId: "r1" }))
        .status,
    ).toBe(404);
    expect(
      (await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: a.id, roomId: "gone" }))
        .status,
    ).toBe(404);

    await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: a.id, roomId: "r1" });
    await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: b.id, roomId: "r1" });
    expect(items).toHaveLength(1);
    expect(items[0].folder_id).toBe(b.id);

    const list = await listRoomFolders(env, { projectId: "p1", userId: "u1" });
    expect(list.folders.find((f) => f.id === b.id).roomIds).toEqual(["r1"]);
  });

  it("renames, removes items, and deletes folders with their items", async () => {
    const { env, items, folders } = createEnv();
    const folder = (await createRoomFolder(env, { projectId: "p1", userId: "u1", name: "x" })).folder;
    await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: folder.id, roomId: "r1" });

    const renamed = await renameRoomFolder(env, {
      projectId: "p1",
      userId: "u1",
      folderId: folder.id,
      name: "y",
    });
    expect(renamed.folder.name).toBe("y");
    expect(
      (await renameRoomFolder(env, { projectId: "p1", userId: "u2", folderId: folder.id, name: "z" }))
        .status,
    ).toBe(404);

    await removeRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: folder.id, roomId: "r1" });
    expect(items).toHaveLength(0);

    await setRoomFolderItem(env, { projectId: "p1", userId: "u1", folderId: folder.id, roomId: "r2" });
    await deleteRoomFolder(env, { projectId: "p1", userId: "u1", folderId: folder.id });
    expect(folders).toHaveLength(0);
    expect(items).toHaveLength(0);
  });
});
