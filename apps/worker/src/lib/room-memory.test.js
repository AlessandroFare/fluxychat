import { describe, expect, it } from "vitest";
import {
  persistRoomMemory,
  queryRoomMemory,
  deleteRoomMemoryEntry,
} from "./room-memory.js";

function createMemoryEnv(overrides = {}) {
  const memoryEntries = [];
  let nextId = 1;

  return {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT id, confidence FROM room_memory")) {
                  const [, , kind, content] = args;
                  return memoryEntries.find(
                    (e) => e.kind === kind && e.content === content && e.project_id === args[0] && e.room_id === args[1],
                  ) || null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM room_memory")) {
                  const projectId = args[0];
                  const roomId = args[1];
                  let filtered = memoryEntries.filter(
                    (e) => e.project_id === projectId && e.room_id === roomId,
                  );
                  // args layout: [projectId, roomId, nowISO, kind?(optional), limit]
                  if (sql.includes("AND kind = ?")) {
                    const kind = args[3];
                    if (kind) {
                      filtered = filtered.filter((e) => e.kind === kind);
                    }
                  }
                  return { results: filtered };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO room_memory")) {
                  const entry = {
                    id: args[0],
                    project_id: args[1],
                    room_id: args[2],
                    kind: args[3],
                    content: args[4],
                    source_message_ids: args[5],
                    confidence: args[6],
                    created_at: args[7],
                    updated_at: args[8],
                  };
                  memoryEntries.push(entry);
                }
                if (sql.includes("UPDATE room_memory")) {
                  const newConf = args[0];
                  const entryId = args[2];
                  const entry = memoryEntries.find((e) => e.id === entryId);
                  if (entry) entry.confidence = newConf;
                }
                if (sql.includes("DELETE FROM room_memory")) {
                  const entryId = args[0];
                  const idx = memoryEntries.findIndex((e) => e.id === entryId);
                  if (idx >= 0) memoryEntries.splice(idx, 1);
                }
                return { success: true };
              },
            };
          },
        };
      },
    },
    ...overrides,
  };
}

describe("persistRoomMemory", () => {
  it("inserts new entries", async () => {
    const env = createMemoryEnv();
    const entries = [
      {
        id: "mem_1",
        project_id: "proj_1",
        room_id: "room_1",
        kind: "decision",
        content: "We decided to use PostgreSQL",
        source_message_ids: '["msg_1"]',
        confidence: 0.9,
        created_at: "2026-06-11T10:00:00.000Z",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
    ];
    const result = await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries,
    });
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(1);
    expect(result.updated).toBe(0);
  });

  it("updates existing entries with higher confidence", async () => {
    const env = createMemoryEnv();
    const entries = [
      {
        id: "mem_1",
        project_id: "proj_1",
        room_id: "room_1",
        kind: "decision",
        content: "We decided to use PostgreSQL",
        source_message_ids: '["msg_1"]',
        confidence: 0.9,
        created_at: "2026-06-11T10:00:00.000Z",
        updated_at: "2026-06-11T10:00:00.000Z",
      },
    ];

    await persistRoomMemory(env, { projectId: "proj_1", roomId: "room_1", entries });

    const updatedEntries = [
      {
        ...entries[0],
        id: "mem_2",
        confidence: 0.95,
        updated_at: "2026-06-11T11:00:00.000Z",
      },
    ];
    const result = await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: updatedEntries,
    });
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
  });

  it("skips entries with lower confidence than existing", async () => {
    const env = createMemoryEnv();
    await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [
        {
          id: "mem_1",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "decision",
          content: "Use PostgreSQL",
          source_message_ids: "[]",
          confidence: 0.95,
          created_at: "2026-06-11T10:00:00.000Z",
          updated_at: "2026-06-11T10:00:00.000Z",
        },
      ],
    });

    const result = await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [
        {
          id: "mem_2",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "decision",
          content: "Use PostgreSQL",
          source_message_ids: "[]",
          confidence: 0.5,
          created_at: "2026-06-11T11:00:00.000Z",
          updated_at: "2026-06-11T11:00:00.000Z",
        },
      ],
    });
    expect(result.updated).toBe(0);
  });

  it("returns ok with zero when entries array is empty", async () => {
    const env = createMemoryEnv();
    const result = await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [],
    });
    expect(result.ok).toBe(true);
    expect(result.inserted).toBe(0);
  });
});

describe("queryRoomMemory", () => {
  it("returns entries for a room", async () => {
    const env = createMemoryEnv();
    await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [
        {
          id: "mem_1",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "decision",
          content: "Use PostgreSQL",
          source_message_ids: "[]",
          confidence: 0.9,
          created_at: "2026-06-11T10:00:00.000Z",
          updated_at: "2026-06-11T10:00:00.000Z",
        },
        {
          id: "mem_2",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "faq",
          content: "How to deploy? Use wrangler deploy.",
          source_message_ids: "[]",
          confidence: 0.85,
          created_at: "2026-06-11T10:01:00.000Z",
          updated_at: "2026-06-11T10:01:00.000Z",
        },
      ],
    });

    const result = await queryRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
    });
    expect(result.entries).toHaveLength(2);
  });

  it("filters by kind", async () => {
    const env = createMemoryEnv();
    await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [
        {
          id: "mem_1",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "decision",
          content: "Use PostgreSQL",
          source_message_ids: "[]",
          confidence: 0.9,
          created_at: "2026-06-11T10:00:00.000Z",
          updated_at: "2026-06-11T10:00:00.000Z",
        },
        {
          id: "mem_2",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "faq",
          content: "How to deploy?",
          source_message_ids: "[]",
          confidence: 0.85,
          created_at: "2026-06-11T10:01:00.000Z",
          updated_at: "2026-06-11T10:01:00.000Z",
        },
      ],
    });

    const result = await queryRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      kind: "decision",
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].kind).toBe("decision");
  });

  it("returns empty for unknown room", async () => {
    const env = createMemoryEnv();
    const result = await queryRoomMemory(env, {
      projectId: "proj_1",
      roomId: "unknown",
    });
    expect(result.entries).toHaveLength(0);
  });
});

describe("deleteRoomMemoryEntry", () => {
  it("deletes an entry by id", async () => {
    const env = createMemoryEnv();
    await persistRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
      entries: [
        {
          id: "mem_1",
          project_id: "proj_1",
          room_id: "room_1",
          kind: "decision",
          content: "Use PostgreSQL",
          source_message_ids: "[]",
          confidence: 0.9,
          created_at: "2026-06-11T10:00:00.000Z",
          updated_at: "2026-06-11T10:00:00.000Z",
        },
      ],
    });

    const result = await deleteRoomMemoryEntry(env, {
      projectId: "proj_1",
      entryId: "mem_1",
    });
    expect(result.ok).toBe(true);

    const query = await queryRoomMemory(env, {
      projectId: "proj_1",
      roomId: "room_1",
    });
    expect(query.entries).toHaveLength(0);
  });
});
