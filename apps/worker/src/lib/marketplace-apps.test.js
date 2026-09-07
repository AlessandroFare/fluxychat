import { describe, expect, it } from "vitest";
import { listProjectApps, publishProjectApp, deleteProjectApp } from "./marketplace-apps.js";

function memoryEnv() {
  const store = new Map();
  return {
    RATE_LIMIT_KV: {
      async put(key, value) {
        store.set(key, value);
      },
      async get(key) {
        return store.get(key) ?? null;
      },
    },
  };
}

describe("marketplace-apps", () => {
  it("publishes and lists apps for a project", async () => {
    const env = memoryEnv();
    const published = await publishProjectApp(env, {
      projectId: "p1",
      name: "Support pack",
      permissions: ["chat:write", "chat:read"],
      publisherId: "admin-1",
    });
    expect(published.app.name).toBe("Support pack");
    const listed = await listProjectApps(env, { projectId: "p1" });
    expect(listed).toHaveLength(1);
    const removed = await deleteProjectApp(env, { projectId: "p1", appId: published.app.appId });
    expect(removed.deleted).toBe(1);
  });
});
