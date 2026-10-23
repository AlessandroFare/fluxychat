import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchUserGroupsRoutes } from "./user-groups-http.js";
import * as lib from "../lib/user-groups.js";

vi.mock("../lib/user-groups.js", () => ({
  listUserGroups: vi.fn(async () => ({ groups: [{ id: "g1", name: "design" }] })),
  createUserGroup: vi.fn(async () => ({ ok: true, group: { id: "g1", name: "design" } })),
  deleteUserGroup: vi.fn(async () => ({ ok: true })),
  addUserGroupMembers: vi.fn(async () => ({ ok: true, added: 1 })),
  removeUserGroupMember: vi.fn(async () => ({ ok: true })),
}));

function deps({ roles = ["owner"], extra = {} } = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => ({ userId: "user_bob", projectId: "p1", roles }),
    extra,
  });
}

function request(path, { method = "GET", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  return dispatchUserGroupsRoutes(
    new Request(`http://127.0.0.1:8787${path}`, init),
    new URL(`http://127.0.0.1:8787${path}`),
    h,
  );
}

describe("user group routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401s without a JWT", async () => {
    const res = await request("/user-groups", {}, createAuthMatrixDeps());
    expect(res.status).toBe(401);
  });

  it("GET lists groups for any member", async () => {
    const res = await request("/user-groups", {}, deps({ roles: ["member"] }));
    expect(res.status).toBe(200);
    expect((await res.json()).groups).toEqual([{ id: "g1", name: "design" }]);
    expect(lib.listUserGroups).toHaveBeenCalledWith(expect.anything(), { projectId: "p1" });
  });

  it("POST requires admin and 409s on duplicates", async () => {
    const denied = await request(
      "/user-groups",
      { method: "POST", body: { name: "design", memberIds: ["u1"] } },
      deps({ roles: ["member"] }),
    );
    expect(denied.status).toBe(403);

    lib.createUserGroup.mockResolvedValueOnce({ ok: false, error: "group_exists", status: 409 });
    const dup = await request(
      "/user-groups",
      { method: "POST", body: { name: "design", memberIds: ["u1"] } },
      deps(),
    );
    expect(dup.status).toBe(409);
    expect(lib.createUserGroup).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      name: "design",
      memberIds: ["u1"],
    });
  });

  it("POST/DELETE member routes require admin and forward decoded ids", async () => {
    const denied = await request(
      "/user-groups/g1/members",
      { method: "POST", body: { userIds: ["u2"] } },
      deps({ roles: ["member"] }),
    );
    expect(denied.status).toBe(403);

    const added = await request(
      "/user-groups/g1/members",
      { method: "POST", body: { userIds: ["u2"] } },
      deps(),
    );
    expect(added.status).toBe(200);
    expect(lib.addUserGroupMembers).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      groupId: "g1",
      userIds: ["u2"],
    });

    const removed = await request("/user-groups/g1/members/user%202", { method: "DELETE" }, deps());
    expect(removed.status).toBe(200);
    expect(lib.removeUserGroupMember).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      groupId: "g1",
      userId: "user 2",
    });
  });

  it("DELETE 404s on an unknown group", async () => {
    lib.deleteUserGroup.mockResolvedValueOnce({ ok: false, error: "group_not_found", status: 404 });
    const res = await request("/user-groups/missing", { method: "DELETE" }, deps());
    expect(res.status).toBe(404);
  });
});
