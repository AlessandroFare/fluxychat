import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { dispatchRealtimeStatsRoutes } from "./realtime-stats-http.js";

const SCHEMA = `
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  room_id TEXT,
  user_id TEXT,
  content TEXT,
  created_at TEXT,
  parent_id INTEGER,
  edited_at TEXT,
  deleted_at TEXT,
  mentions TEXT,
  og_title TEXT,
  og_description TEXT,
  og_image TEXT,
  og_url TEXT,
  client_message_id TEXT,
  also_to_channel INTEGER,
  kind TEXT,
  audio_url TEXT,
  duration_ms INTEGER,
  transcription TEXT,
  transcription_status TEXT,
  project_id TEXT,
  visibility TEXT,
  visible_to_json TEXT
);
CREATE TABLE room_members (room_id TEXT, user_id TEXT, role TEXT);
`;

function seed(db) {
  const insert = db.prepare(
    "INSERT INTO messages (id, room_id, user_id, content, created_at, project_id, visibility, visible_to_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  const rows = [
    [1, "2026-10-18T10:00:00.000Z"],
    [2, "2026-10-18T10:01:00.000Z"],
    [3, "2026-10-18T10:02:00.000Z"],
    [4, "2026-10-18T10:03:00.000Z"],
    [5, "2026-10-18T10:04:00.000Z"],
    [6, "2026-10-18T10:05:00.000Z"],
    // Historical import: old createdAt with a newer id (P14 scenario).
    [7, "2026-09-01T09:00:00.000Z"],
    [8, "2026-09-01T09:00:00.000Z"],
    // Timestamp ties (P5 scenario).
    [9, "2026-10-18T10:05:00.000Z"],
    [10, "2026-10-18T10:05:00.000Z"],
  ];
  for (const [id, createdAt] of rows) {
    insert.run(id, "r1", "u2", `m${id}`, createdAt, "p1", "room", null);
  }
}

function createHarness() {
  const db = new DatabaseSync(":memory:");
  db.exec(SCHEMA);
  seed(db);
  const queries = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              first: async () => {
                if (sql.includes("SELECT created_at FROM messages")) {
                  return db.prepare(sql).get(...args) ?? null;
                }
                return null;
              },
              run: async () => ({ meta: {} }),
              all: async () => {
                if (sql.includes("FROM messages WHERE project_id")) {
                  queries.push({ sql, args });
                  return { results: db.prepare(sql).all(...args) };
                }
                return { results: [] };
              },
            };
          },
        };
      },
    },
  };
  const h = {
    env,
    corsHeaders: {},
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json" },
      }),
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles: ["member"] }),
    hasAnyRole: (roles, allowed) => roles.some((r) => allowed.includes(r)),
    logError: () => {},
    projectId: "p1",
    isRoomMember: async () => true,
    canAccessRoom: async () => true,
    attachAttachmentsToMessages: async (_env, _projectId, _roomId, rows) => rows,
    getProjectPlan: async () => null,
    getDefaultQuotaLimit: () => 0,
    monthKeyUtc: () => "2026-10",
    toMinuteBucketIso: (value) => new Date(value).toISOString(),
    evaluateOperationalAlerts: () => ({}),
    canCreateTenantProjects: () => true,
    tenantScopeForbidden: () => null,
    writeAuditEvent: async () => {},
  };
  return { h, queries };
}

async function page(h, query) {
  const request = new Request(`https://worker/api/messages?${query}`);
  const res = await dispatchRealtimeStatsRoutes(request, new URL(request.url), h);
  const body = await res.json();
  return { status: res.status, body };
}

describe("GET /api/messages paging (P5/P11)", () => {
  it("P5: paging with beforeSerial reaches imports and ties (SDK cursor loop)", async () => {
    const { h } = createHarness();
    const seen = new Set();
    let cursor = null;
    for (let i = 0; i < 12; i += 1) {
      const { status, body } = await page(
        h,
        `roomId=r1&limit=3${cursor != null ? `&beforeSerial=${cursor}` : ""}`,
      );
      expect(status).toBe(200);
      const rows = body.messages;
      if (!rows.length) break;
      let added = 0;
      for (const row of rows) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          added += 1;
        }
      }
      if (added === 0) break; // no progress — stop instead of looping
      // SDK next(): cursor is the oldest row of the page (last in DESC order).
      cursor = rows[rows.length - 1].id;
    }
    expect(seen.size).toBe(10);
    expect(seen.has(7)).toBe(true);
    expect(seen.has(8)).toBe(true);
  });

  it("P11: non-positive or non-numeric limit is rejected", async () => {
    const { h } = createHarness();
    for (const raw of ["-1", "0", "abc"]) {
      const { status, body } = await page(h, `roomId=r1&limit=${raw}`);
      expect(status).toBe(400);
      expect(body.error).toBe("invalid_limit");
    }
  });

  it("P11: an oversized limit is clamped to the max page size", async () => {
    const { h, queries } = createHarness();
    const { status } = await page(h, "roomId=r1&limit=5000");
    expect(status).toBe(200);
    expect(queries.at(-1).args).toContain(500);
  });
});
