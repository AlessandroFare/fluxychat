import { describe, expect, it } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchTranscriptsRoutes } from "./transcripts-http.js";

function createDb({ firstResults = [], allResults = [] } = {}) {
  const calls = [];
  let firstIdx = 0;
  return {
    calls,
    prepare(sql) {
      return {
        bind(...args) {
          calls.push({ sql, args });
          return {
            run: async () => ({ meta: { changes: 1 } }),
            first: async () => firstResults[firstIdx++] ?? null,
            all: async () => ({ results: allResults }),
          };
        },
      };
    },
  };
}

function deps(db, { roles = ["admin"] } = {}) {
  return createAuthMatrixDeps({
    db,
    verifyJwt: async () => ({ userId: "u1", projectId: "p1", roles }),
  });
}

function req(path, { method = "GET", body } = {}) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return new Request(`http://127.0.0.1:8787${path}`, init);
}

const call = (request, h) => dispatchTranscriptsRoutes(request, new URL(request.url), h);

describe("transcripts admin routes", () => {
  it("returns 401 without a JWT", async () => {
    const res = await call(req("/admin/transcripts"), createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("returns 403 for a member JWT", async () => {
    const res = await call(req("/admin/transcripts"), deps(createDb(), { roles: ["member"] }));
    expect(res.status).toBe(403);
  });

  it("validates append payloads", async () => {
    const h = deps(createDb());
    const noKey = await call(req("/admin/transcripts", { method: "POST", body: { text: "hi" } }), h);
    expect(noKey.status).toBe(400);
    const noText = await call(req("/admin/transcripts", { method: "POST", body: { userKey: "u@example.com" } }), h);
    expect(noText.status).toBe(400);
    const badRole = await call(
      req("/admin/transcripts", { method: "POST", body: { userKey: "u@example.com", text: "hi", role: "root" } }),
      h,
    );
    expect(badRole.status).toBe(400);
  });

  it("appends a project-scoped entry", async () => {
    const db = createDb({ firstResults: [{ count: 1 }] });
    const res = await call(
      req("/admin/transcripts", {
        method: "POST",
        body: {
          userKey: "u@example.com",
          role: "assistant",
          text: "hello",
          platform: "slack",
          threadId: "C1",
          platformMessageId: "m1",
        },
      }),
      deps(db),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.entry.userKey).toBe("u@example.com");
    expect(body.entry.role).toBe("assistant");
    const insert = db.calls[0];
    expect(insert.args[1]).toBe("p1");
    expect(insert.args[8]).toBe("m1");
  });

  it("lists entries and counts them", async () => {
    const db = createDb({
      firstResults: [{ count: 2 }],
      allResults: [
        { id: "t1", user_key: "u", role: "user", text: "a", platform: "slack", thread_id: "C1", timestamp: 1, platform_message_id: null },
      ],
    });
    const h = deps(db);
    const listRes = await call(req("/admin/transcripts?userKey=u&platforms=slack&roles=user,assistant&limit=5"), h);
    expect(listRes.status).toBe(200);
    const listBody = await listRes.json();
    expect(listBody.entries).toHaveLength(1);
    expect(listBody.entries[0].userKey).toBe("u");

    const countRes = await call(req("/admin/transcripts/count?userKey=u"), h);
    expect(countRes.status).toBe(200);
    expect((await countRes.json()).count).toBe(2);
  });

  it("deletes a user's transcript", async () => {
    const db = createDb({ firstResults: [{ count: 3 }] });
    const res = await call(req("/admin/transcripts?userKey=u", { method: "DELETE" }), deps(db));
    expect(res.status).toBe(200);
    expect((await res.json()).deleted).toBe(3);
    const del = db.calls.find(
      (c) => c.sql.startsWith("DELETE FROM user_transcripts WHERE project_id = ? AND user_key = ?"),
    );
    expect(del.args).toEqual(["p1", "u"]);
  });
});
