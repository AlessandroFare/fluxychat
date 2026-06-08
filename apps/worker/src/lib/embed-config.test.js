import { describe, expect, it } from "vitest";
import {
  clampZIndex,
  getPublicEmbedConfig,
  upsertEmbedConfig,
  validateEmbedParentOrigin,
} from "./embed-config.js";

describe("embed-config", () => {
  it("clampZIndex keeps widget above page chrome", () => {
    expect(clampZIndex(0)).toBe(1);
    expect(clampZIndex(2147483000)).toBe(2147483000);
    expect(clampZIndex(9999999999)).toBe(2147483647);
  });

  it("upsert enables embed config for a project room", async () => {
    const env = createEmbedEnv();
    const saved = await upsertEmbedConfig(
      env,
      {
        projectId: "proj_1",
        enabled: true,
        defaultRoomId: "room_1",
        allowedOrigins: ["https://acme.com"],
        zIndex: 2147483000,
        launcherTitle: "Support",
        theme: { primaryColor: "#111827", position: "bottom-left" },
      },
      { isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id) },
    );
    expect(saved.ok).toBe(true);
    expect(saved.config.enabled).toBe(true);
    expect(saved.config.allowedOrigins).toContain("https://acme.com");

    const pub = await getPublicEmbedConfig(env, "proj_1", "chat.acme.com");
    expect(pub.enabled).toBe(true);
    expect(pub.defaultRoomId).toBe("room_1");
    expect(pub.framePath).toBe("/embed/frame");
  });

  it("validateEmbedParentOrigin rejects unknown parent sites", async () => {
    const env = createEmbedEnv();
    await upsertEmbedConfig(
      env,
      {
        projectId: "proj_1",
        enabled: true,
        allowedOrigins: ["https://acme.com"],
      },
      { isValidId: (id) => /^[a-zA-Z0-9_-]{1,128}$/.test(id) },
    );

    const request = new Request("https://chat.acme.com/embed/frame");
    const embedConfig = { enabled: true, allowedOrigins: ["https://acme.com"] };

    const ok = await validateEmbedParentOrigin(env, request, {
      projectId: "proj_1",
      embedConfig,
      parentOrigin: "https://acme.com",
    });
    expect(ok.ok).toBe(true);

    const bad = await validateEmbedParentOrigin(env, request, {
      projectId: "proj_1",
      embedConfig,
      parentOrigin: "https://evil.example",
    });
    expect(bad.ok).toBe(false);
    expect(bad.error).toBe("embed_origin_forbidden");
  });
});

function createEmbedEnv() {
  const configs = [];
  const rooms = [{ id: "room_1", project_id: "proj_1" }];
  const domains = [
    {
      hostname: "chat.acme.com",
      project_id: "proj_1",
      status: "active",
      default_room_id: "room_1",
      allowed_origins: '["https://acme.com"]',
    },
  ];

  return {
    EMBED_WIDGET_ENABLED: "true",
    PUBLIC_GUEST_READ_ONLY: "false",
    DB: {
      prepare(sql) {
        return {
          bind(...binds) {
            return {
              first: async () => {
                if (sql.includes("FROM rooms")) {
                  return rooms.find(
                    (r) => r.id === binds[0] && r.project_id === binds[1],
                  );
                }
                if (sql.includes("FROM project_embed_configs")) {
                  return configs.find((c) => c.project_id === binds[0]) || null;
                }
                if (sql.includes("FROM project_custom_domains")) {
                  if (sql.includes("hostname = ?")) {
                    return (
                      domains.find(
                        (d) =>
                          d.hostname === binds[0] && d.project_id === binds[1],
                      ) || null
                    );
                  }
                }
                return null;
              },
              all: async () => {
                if (sql.includes("FROM project_custom_domains")) {
                  return {
                    results: domains.filter((d) => d.project_id === binds[0]),
                  };
                }
                return { results: [] };
              },
              run: async () => {
                if (sql.includes("INSERT INTO project_embed_configs")) {
                  configs.push({
                    project_id: binds[0],
                    enabled: binds[1],
                    default_room_id: binds[2],
                    allowed_origins: binds[3],
                    z_index: binds[4],
                    launcher_title: binds[5],
                    theme_json: binds[6],
                    created_at: binds[7],
                    updated_at: binds[8],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE project_embed_configs")) {
                  const cfg = configs.find((c) => c.project_id === binds[7]);
                  if (cfg) {
                    cfg.enabled = binds[0];
                    cfg.default_room_id = binds[1];
                    cfg.allowed_origins = binds[2];
                    cfg.z_index = binds[3];
                    cfg.launcher_title = binds[4];
                    cfg.theme_json = binds[5];
                    cfg.updated_at = binds[6];
                  }
                  return { meta: { changes: cfg ? 1 : 0 } };
                }
                if (sql.includes("INSERT OR IGNORE")) {
                  return { meta: { changes: 0 } };
                }
                return { meta: { changes: 0 } };
              },
            };
          },
        };
      },
    },
  };
}
