import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";
import { dispatchRealtimeStatsRoutes } from "./realtime-stats-http.js";

function createHarness() {
  const reads = [];
  const env = {
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              sql,
              args,
              first: async () => null,
              run: async () => ({ meta: {} }),
              all: async () => {
                reads.push({ sql, args });
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
  return { h, reads };
}

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
  const row = db.prepare(
    "INSERT INTO messages (id, room_id, user_id, content, created_at, project_id, visibility, visible_to_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  row.run(1, "r1", "u2", "room hello", "2026-10-18T10:00:00.000Z", "p1", "room", null);
  row.run(2, "r1", "u2", "for u1", "2026-10-18T10:01:00.000Z", "p1", "whisper", '["u1"]');
  row.run(3, "r1", "u2", "for u2", "2026-10-18T10:02:00.000Z", "p1", "whisper", '["u2"]');
  row.run(4, "r1", "u9", "mod only", "2026-10-18T10:03:00.000Z", "p1", "role:moderator", null);
  row.run(5, "r1", "u1", "own whisper", "2026-10-18T10:04:00.000Z", "p1", "whisper", '["u9"]');
}

describe("GET /api/messages visibility", () => {
  it("hides whispers and role rows from non-recipients (real sqlite)", async () => {
    const { h, reads } = createHarness();
    const request = new Request("https://worker/api/messages?roomId=r1&limit=50");
    const res = await dispatchRealtimeStatsRoutes(request, new URL(request.url), h);
    expect(res.status).toBe(200);

    const captured = reads.find((q) => q.sql.includes("FROM messages WHERE project_id"));
    expect(captured).toBeTruthy();

    const db = new DatabaseSync(":memory:");
    db.exec(SCHEMA);
    seed(db);

    const rows = db.prepare(captured.sql).all(...captured.args);
    const contents = rows.map((r) => r.content);
    expect(contents).toContain("room hello");
    expect(contents).toContain("for u1");
    expect(contents).toContain("own whisper");
    expect(contents).not.toContain("for u2");
    expect(contents).not.toContain("mod only");
  });
});
