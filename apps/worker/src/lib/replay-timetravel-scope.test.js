import { describe, it, expect, vi } from "vitest";

vi.mock("cloudflare:test", () => ({ env: { DB: { prepare: vi.fn() } } }));

const env = {};

describe("replay-timetravel project scoping (A2-8)", () => {
  it("A2-8: scopes replay reads and writes to the caller's project", async () => {
    const sqls = [];
    const binds = [];
    const chain = {
      bind: vi.fn(function (...params) {
        binds.push(params);
        return this;
      }),
      run: vi.fn().mockResolvedValue({ meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
    env.DB = {
      prepare: vi.fn((sql) => {
        sqls.push(sql);
        return chain;
      }),
    };
    const R = await import("../lib/replay-timetravel.js");

    await R.getSession(env, { sessionId: "rs1", projectId: "proj_own" });
    await R.updateSession(env, { sessionId: "rs1", projectId: "proj_own", status: "stopped" });
    await R.listSnapshots(env, { sessionId: "rs1", projectId: "proj_own" });
    await R.getSnapshotAtSequence(env, { sessionId: "rs1", projectId: "proj_own", sequenceNumber: 3 });
    await R.listEvents(env, { sessionId: "rs1", projectId: "proj_own" });
    await R.getEventsInRange(env, { sessionId: "rs1", projectId: "proj_own", fromTime: "a", toTime: "b" });
    await R.listBookmarks(env, { sessionId: "rs1", projectId: "proj_own" });
    await R.listDiffs(env, { sessionId: "rs1", projectId: "proj_own" });

    expect(sqls).toHaveLength(8);
    for (const sql of sqls) {
      expect(sql).toMatch(/project_id = \?/);
    }

    // Writes refuse when the session belongs to another project.
    const snapshot = await R.createSnapshot(env, { sessionId: "rs_victim", projectId: "proj_own" });
    expect(snapshot.error).toBe("not_found");
    const event = await R.recordEvent(env, { sessionId: "rs_victim", projectId: "proj_own", roomId: "r1", eventType: "join" });
    expect(event.error).toBe("not_found");
    const bookmark = await R.createBookmark(env, { sessionId: "rs_victim", projectId: "proj_own", name: "b" });
    expect(bookmark.error).toBe("not_found");
    const diff = await R.createDiff(env, { sessionId: "rs_victim", projectId: "proj_own" });
    expect(diff.error).toBe("not_found");
  });
});
