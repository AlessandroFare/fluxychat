import { describe, expect, it, vi } from "vitest";
import { requireApiProjectAdmin, withAuthProjectId } from "./api-route-project-auth.js";

describe("api-route-project-auth", () => {
  it("withAuthProjectId binds tenant on payloads", () => {
    expect(withAuthProjectId({ name: "x", projectId: "other" }, "proj_auth")).toEqual({
      name: "x",
      projectId: "proj_auth",
    });
  });

  it("requireApiProjectAdmin returns 401 without JWT", async () => {
    const request = new Request("https://worker.example/api/cdp/customers");
    const h = {
      env: {},
      verifyJwtAndGetContext: vi.fn(async () => null),
      hasAnyRole: () => true,
    };
    const gate = await requireApiProjectAdmin(request, h);
    expect(gate.response?.status).toBe(401);
  });

  it("requireApiProjectAdmin returns projectId from auth", async () => {
    const request = new Request("https://worker.example/api/cdp/customers", {
      headers: { Authorization: "Bearer tok" },
    });
    const h = {
      env: {},
      verifyJwtAndGetContext: vi.fn(async () => ({
        projectId: "proj_1",
        userId: "u1",
        roles: ["owner"],
      })),
      hasAnyRole: (roles, allowed) => allowed.some((r) => roles.includes(r)),
    };
    const gate = await requireApiProjectAdmin(request, h);
    expect(gate.projectId).toBe("proj_1");
  });
});
