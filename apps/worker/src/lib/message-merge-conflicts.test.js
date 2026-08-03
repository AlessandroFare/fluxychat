import { describe, it, expect } from "vitest";
import {
  isTrueMergeConflict,
  reportMergeConflict,
  resolveMergeConflict,
  listMergeConflicts,
} from "./message-merge-conflicts.js";

function createEnv() {
  const conflicts = [];
  const messages = new Map();

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM message_merge_conflicts") && sql.includes("AND id = ?")) {
                  return (
                    conflicts.find((c) => c.project_id === args[0] && c.id === args[1]) ?? null
                  );
                }
                if (sql.includes("status = 'open'") && sql.includes("message_key")) {
                  return (
                    conflicts.find(
                      (c) =>
                        c.project_id === args[0] &&
                        c.room_id === args[1] &&
                        c.message_key === args[2] &&
                        c.status === "open",
                    ) ?? null
                  );
                }
                if (sql.includes("FROM messages WHERE id")) {
                  return messages.get(args[0]) ?? null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM message_merge_conflicts") && sql.includes("room_id")) {
                  return {
                    results: conflicts.filter(
                      (c) =>
                        c.project_id === args[0] &&
                        c.room_id === args[1] &&
                        c.status === args[2],
                    ),
                  };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO message_merge_conflicts")) {
                  conflicts.push({
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    message_id: args[3],
                    client_message_id: args[4],
                    parent_message_id: args[5],
                    message_key: args[6],
                    status: "open",
                    version_a_json: args[7],
                    version_b_json: args[8],
                    created_at: args[9],
                    resolution: null,
                    merged_content: null,
                    resolved_by: null,
                    resolved_at: null,
                  });
                }
                if (sql.includes("UPDATE message_merge_conflicts")) {
                  const row = conflicts.find((c) => c.id === args[4] && c.project_id === args[5]);
                  if (row) {
                    row.status = "resolved";
                    row.resolution = args[0];
                    row.merged_content = args[1];
                    row.resolved_by = args[2];
                    row.resolved_at = args[3];
                  }
                }
                if (sql.includes("UPDATE messages SET content")) {
                  const row = messages.get(args[2]);
                  if (row) {
                    row.content = args[0];
                    row.edited_at = args[1];
                  }
                }
                if (sql.includes("INSERT INTO messages")) {
                  const id = messages.size + 1;
                  messages.set(id, {
                    id,
                    project_id: args[0],
                    room_id: args[1],
                    user_id: args[2],
                    content: args[3],
                  });
                  return { meta: { last_row_id: id } };
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    _conflicts: conflicts,
    _messages: messages,
  };
}

describe("message-merge-conflicts", () => {
  it("isTrueMergeConflict detects concurrent divergent edits", () => {
    expect(
      isTrueMergeConflict(
        {
          content: "Offer A",
          originInstance: "matrix",
          ts: "2026-08-01T00:00:00.000Z",
          messageId: 7,
        },
        {
          content: "Offer B",
          originInstance: "web",
          ts: "2026-08-01T00:00:01.000Z",
          messageId: 7,
        },
      ),
    ).toBe(true);
  });

  it("isTrueMergeConflict rejects clear LWW winner", () => {
    expect(
      isTrueMergeConflict(
        {
          content: "old",
          originInstance: "rest",
          ts: "2026-08-01T00:00:00.000Z",
          messageId: 5,
        },
        {
          content: "new",
          originInstance: "yjs",
          ts: "2026-08-01T00:10:00.000Z",
          messageId: 5,
        },
      ),
    ).toBe(false);
  });

  it("reportMergeConflict creates open conflict", async () => {
    const env = createEnv();
    const result = await reportMergeConflict(env, {
      projectId: "p1",
      roomId: "lobby",
      messageKey: "c:msg1",
      messageId: 42,
      versionA: {
        content: "Version A",
        originInstance: "matrix",
        ts: "2026-08-01T00:00:00.000Z",
        messageId: 42,
      },
      versionB: {
        content: "Version B",
        originInstance: "web",
        ts: "2026-08-01T00:00:01.000Z",
        messageId: 42,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.conflictId).toBeTruthy();
  });

  it("resolveMergeConflict merge_both combines content", async () => {
    const env = createEnv();
    env._messages.set(42, { id: 42, room_id: "lobby", user_id: "alice", content: "old" });
    const reported = await reportMergeConflict(env, {
      projectId: "p1",
      roomId: "lobby",
      messageKey: "s:42",
      messageId: 42,
      versionA: { content: "A", originInstance: "a", ts: "2026-08-01T00:00:00.000Z", messageId: 42 },
      versionB: { content: "B", originInstance: "b", ts: "2026-08-01T00:00:01.000Z", messageId: 42 },
    });
    const resolved = await resolveMergeConflict(env, {
      projectId: "p1",
      conflictId: reported.conflictId,
      resolution: "merge_both",
      resolvedBy: "mod1",
    });
    expect(resolved.ok).toBe(true);
    expect(resolved.content).toContain("A");
    expect(resolved.content).toContain("B");
    const open = await listMergeConflicts(env, { projectId: "p1", roomId: "lobby" });
    expect(open).toHaveLength(0);
  });
});
