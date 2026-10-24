import { describe, expect, it } from "vitest";
import {
  GDPR_REDACTED_USER_MARKER,
  redactUserPayloadsInTable,
  redactUserReferencesInJsonString,
  redactUserReferencesInValue,
} from "./gdpr-payload-redaction.js";

describe("redactUserReferencesInValue", () => {
  it("redacts known id fields and mention arrays", () => {
    const input = {
      userId: "alice",
      fromUserId: "alice",
      toUserIds: ["alice", "bob"],
      nested: { senderId: "alice", note: "alice said hi" },
    };
    const out = redactUserReferencesInValue(input, "alice");
    expect(out.userId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.fromUserId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.toUserIds).toEqual([GDPR_REDACTED_USER_MARKER, "bob"]);
    expect(out.nested.senderId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(out.nested.note).toBe("alice said hi");
  });
});

describe("redactUserReferencesInJsonString", () => {
  it("parses JSON and redacts deeply", () => {
    const raw = JSON.stringify({
      event: "mention.created",
      fromUserId: "u1",
      payload: { userId: "u1", messageId: 9 },
    });
    const next = redactUserReferencesInJsonString(raw, "u1");
    const parsed = JSON.parse(next);
    expect(parsed.fromUserId).toBe(GDPR_REDACTED_USER_MARKER);
    expect(parsed.payload.userId).toBe(GDPR_REDACTED_USER_MARKER);
  });

  it("falls back to string replace on invalid JSON", () => {
    const raw = "not-json u1 tail";
    expect(redactUserReferencesInJsonString(raw, "u1")).toBe(
      `not-json ${GDPR_REDACTED_USER_MARKER} tail`
    );
  });
});

// A2-13: fake that models the two pagination shapes faithfully — the old
// `LIMIT ? OFFSET ?` semantics and the keyset `id > ?` semantics — so the test
// can prove offset drift on a shrinking match set.
function makeDb(rows) {
  const store = rows.map((r) => ({ ...r }));
  return {
    store,
    prepare(sql) {
      return {
        bind: (...args) => ({
          sql,
          args,
          apply() {
            if (typeof sql === "string" && sql.startsWith("UPDATE")) {
              const [next, rowId] = args;
              const row = store.find((r) => r.id === rowId);
              if (row) row.payload = next;
            }
          },
          all: async () => {
            const [projectId, likePattern] = args;
            const needle = likePattern.slice(1, -1).replace(/\\([%_\\])/g, "$1");
            const matched = store
              .filter((r) => r.project_id === projectId && typeof r.payload === "string" && r.payload.includes(needle))
              .sort((a, b) => (a.id < b.id ? -1 : 1));
            if (/(^|\s)id > \?/.test(sql)) {
              const [, , lastId, pageSize] = args;
              return { results: matched.filter((r) => r.id > lastId).slice(0, pageSize).map((r) => ({ row_id: r.id, payload: r.payload })) };
            }
            const [pageSize, offset] = [args[2], args[3]];
            return { results: matched.slice(offset, offset + pageSize).map((r) => ({ row_id: r.id, payload: r.payload })) };
          },
        }),
      };
    },
    async batch(statements) {
      for (const stmt of statements) stmt.apply();
    },
  };
}

describe("redactUserPayloadsInTable", () => {
  it("A2-13: redacts every matching row despite the shrinking match set", async () => {
    const rows = [
      { id: "a1", project_id: "p1", payload: '{"userId":"u1"}' },
      { id: "a2", project_id: "p1", payload: '{"actorUserId":"u1"}' },
      { id: "a3", project_id: "p1", payload: '{"note":"clean"}' },
      { id: "a4", project_id: "p1", payload: '{"toUserIds":["u1"]}' },
    ];
    const db = makeDb(rows);
    const result = await redactUserPayloadsInTable(db, {
      projectId: "p1",
      userId: "u1",
      table: "automation_events",
      pageSize: 2,
    });
    expect(result.redacted).toBe(3);
    expect(db.store.filter((r) => r.payload.includes("u1"))).toEqual([]);
  });
});
