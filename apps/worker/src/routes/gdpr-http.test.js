import { describe, expect, it, vi, beforeEach } from "vitest";
import { dispatchGdprRoutes } from "./gdpr-http.js";
import { GDPR_REDACTED_USER_MARKER } from "../lib/gdpr-payload-redaction.js";
import { deleteUserAttachmentObjects } from "../lib/attachment-storage.js";

vi.mock("../lib/attachment-storage.js", () => ({
  deleteUserAttachmentObjects: vi.fn(async () => ({
    deleted: 0,
    warnings: [],
  })),
}));

function createGdprErasureTestDb() {
  const state = {
    attachments: [],
    automation_events: [
      {
        id: 1,
        project_id: "proj1",
        payload: JSON.stringify({
          fromUserId: "alice",
          toUserIds: ["alice", "bob"],
        }),
      },
    ],
    webhook_deliveries: [
      {
        id: "del-pending",
        project_id: "proj1",
        payload: JSON.stringify({ userId: "alice", event: "message.created" }),
        status: "pending",
      },
      {
        id: "del-done",
        project_id: "proj1",
        payload: JSON.stringify({ userId: "alice", event: "message.created" }),
        status: "delivered",
      },
    ],
  };

  function filterPayloadRows(table, projectId, userId) {
    return state[table].filter(
      (row) =>
        row.project_id === projectId &&
        row.payload != null &&
        String(row.payload).includes(userId)
    );
  }

  const db = {
    state,
    prepare(sql) {
      const normalized = sql.replace(/\s+/g, " ").trim().toLowerCase();
      const stmt = {
        _sql: normalized,
        _args: [],
        bind(...args) {
          this._args = args;
          return this;
        },
        async all() {
          const [projectId, likeOrUser, limit, offset] = this._args;
          const userId =
            typeof likeOrUser === "string" && likeOrUser.includes("%")
              ? likeOrUser.replace(/%/g, "")
              : likeOrUser;

          if (this._sql.includes("from automation_events") && this._sql.includes("payload like")) {
            const rows = filterPayloadRows("automation_events", projectId, userId);
            const off = Number(offset) || 0;
            const lim = Number(limit) || rows.length;
            return { results: rows.slice(off, off + lim).map((r) => ({ row_id: r.id, payload: r.payload })) };
          }
          if (this._sql.includes("from webhook_deliveries") && this._sql.includes("payload like")) {
            const rows = filterPayloadRows("webhook_deliveries", projectId, userId);
            const off = Number(offset) || 0;
            const lim = Number(limit) || rows.length;
            return { results: rows.slice(off, off + lim).map((r) => ({ row_id: r.id, payload: r.payload })) };
          }
          if (this._sql.includes("from attachments") && this._sql.includes("select")) {
            const [projectId, userId] = this._args;
            return {
              results: state.attachments.filter(
                (r) => r.project_id === projectId && r.user_id === userId
              ),
            };
          }
          if (this._sql.includes("distinct room_id from room_members")) return { results: [] };
          if (this._sql.includes("distinct room_id from messages")) return { results: [] };
          return { results: [] };
        },
        async run() {
          if (this._sql.includes("delete from attachments")) {
            const [projectId, userId] = this._args;
            state.attachments = state.attachments.filter(
              (r) => !(r.project_id === projectId && r.user_id === userId)
            );
          }
          if (this._sql.includes("update webhook_deliveries set status = 'cancelled'")) {
            const [updatedAt, projectId, like] = this._args;
            const userId = String(like).replace(/%/g, "");
            for (const row of state.webhook_deliveries) {
              if (
                row.project_id === projectId &&
                ["pending", "retrying"].includes(row.status) &&
                row.payload.includes(userId)
              ) {
                row.status = "cancelled";
                row.last_error = "gdpr_erasure";
                row.updated_at = updatedAt;
              }
            }
          }
          return { meta: { changes: 1 } };
        },
        async first() {
          return 0;
        },
      };
      return stmt;
    },
    async batch(statements) {
      for (const s of statements) {
        const sql = s._sql || "";
        const args = s._args || [];
        if (sql.includes("update automation_events set payload")) {
          const [payload, id, projectId] = args;
          const row = state.automation_events.find((r) => r.id === id && r.project_id === projectId);
          if (row) row.payload = payload;
        }
        if (sql.includes("update webhook_deliveries set payload")) {
          const [payload, updatedAt, id, projectId] = args;
          const row = state.webhook_deliveries.find((r) => r.id === id && r.project_id === projectId);
          if (row) {
            row.payload = payload;
            row.updated_at = updatedAt;
          }
        }
      }
    },
  };

  return db;
}

function buildGdprDeps(db, envExtra = {}) {
  return {
    env: { DB: db, ATTACHMENTS: null, ...envExtra },
    corsHeaders: {},
    json: (data, init = {}) =>
      new Response(JSON.stringify(data), {
        status: init.status || 200,
        headers: { "Content-Type": "application/json", ...(init.headers || {}) },
      }),
    requestLogCtx: {},
    verifyJwt: async () => ({
      userId: "alice",
      projectId: "proj1",
      roles: ["owner", "admin"],
    }),
    writeAuditEvent: async () => {},
    hasAnyRole: (roles, allowed) => allowed.some((r) => roles.includes(r)),
    logError: () => {},
    logInfo: vi.fn(),
    getProjectPlan: async () => null,
  };
}

describe("dispatchGdprRoutes DELETE /gdpr/delete", () => {
  beforeEach(() => {
    vi.mocked(deleteUserAttachmentObjects).mockReset();
    vi.mocked(deleteUserAttachmentObjects).mockResolvedValue({
      deleted: 0,
      warnings: [],
    });
  });

  it("deep-redacts automation_events and webhook_deliveries payloads", async () => {
    const db = createGdprErasureTestDb();
    const deps = buildGdprDeps(db);
    const request = new Request("https://fluxy.local/gdpr/delete", {
      method: "DELETE",
      headers: { Authorization: "Bearer test" },
    });
    const url = new URL(request.url);

    const res = await dispatchGdprRoutes(request, url, deps);
    expect(res?.status).toBe(200);

    const auto = JSON.parse(db.state.automation_events[0].payload);
    expect(auto.fromUserId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(auto.toUserIds).toEqual([GDPR_REDACTED_USER_MARKER, "bob"]);

    const pending = db.state.webhook_deliveries.find((r) => r.id === "del-pending");
    const delivered = db.state.webhook_deliveries.find((r) => r.id === "del-done");
    expect(pending?.status).toBe("cancelled");
    expect(JSON.parse(delivered.payload).userId).toBe(GDPR_REDACTED_USER_MARKER);

    expect(deps.logInfo).toHaveBeenCalledWith(
      "gdpr.payload_redaction",
      expect.objectContaining({
        projectId: "proj1",
        userId: "alice",
      })
    );
  });

  it("deletes user attachment objects from R2 before removing D1 rows", async () => {
    const db = createGdprErasureTestDb();
    db.state.attachments = [
      {
        id: "att-1",
        project_id: "proj1",
        user_id: "alice",
        url: "https://cdn.example/proj1/alice/file.png",
      },
    ];
    vi.mocked(deleteUserAttachmentObjects).mockResolvedValue({
      deleted: 2,
      warnings: [],
    });

    const deps = buildGdprDeps(db, {
      ATTACHMENTS: { delete: vi.fn(), list: vi.fn() },
    });
    const request = new Request("https://fluxy.local/gdpr/delete", {
      method: "DELETE",
      headers: { Authorization: "Bearer test" },
    });

    const res = await dispatchGdprRoutes(request, new URL(request.url), deps);
    expect(res?.status).toBe(200);

    expect(deleteUserAttachmentObjects).toHaveBeenCalledTimes(1);
    const [envArg, projectArg, userArg, rowsArg] =
      vi.mocked(deleteUserAttachmentObjects).mock.calls[0];
    expect(envArg.ATTACHMENTS).toBeDefined();
    expect(projectArg).toBe("proj1");
    expect(userArg).toBe("alice");
    expect(rowsArg).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "att-1",
          url: "https://cdn.example/proj1/alice/file.png",
        }),
      ])
    );
    expect(db.state.attachments).toHaveLength(0);
    expect(deps.logInfo).toHaveBeenCalledWith(
      "gdpr.erasure_completed",
      expect.objectContaining({ projectId: "proj1", userId: "alice" })
    );
  });
});
