import { describe, expect, it } from "vitest";
import { createSpatialScene, addSpatialEntity, grantSpatialAgent } from "./digital-twin.js";

function mockDb() {
  const scenes = new Map();
  const entities = new Map();
  const grants = new Map();

  return {
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async run() {
              if (sql.includes("INSERT INTO spatial_scenes")) {
                scenes.set(params[0], {
                  id: params[0],
                  project_id: params[1],
                  room_id: params[2],
                  name: params[3],
                  metadata_json: params[4],
                  updated_at: params[6],
                });
              }
              if (sql.includes("INSERT INTO spatial_entities")) {
                entities.set(params[0], {
                  id: params[0],
                  scene_id: params[1],
                  project_id: params[2],
                  type: params[3],
                  position_json: params[4],
                });
              }
              if (sql.includes("INSERT INTO spatial_agent_grants")) {
                grants.set(`${params[0]}:${params[2]}`, { grants_json: params[3] });
              }
              if (sql.includes("UPDATE spatial_scenes")) {
                const scene = scenes.get(params[1]);
                if (scene) scene.updated_at = params[0];
              }
            },
            async first() {
              if (sql.includes("FROM spatial_scenes")) {
                return scenes.get(params[1]) ?? null;
              }
              return null;
            },
            async all() {
              if (sql.includes("FROM spatial_scenes")) {
                return { results: Array.from(scenes.values()).filter((s) => s.project_id === params[0]) };
              }
              if (sql.includes("FROM spatial_entities")) {
                return {
                  results: Array.from(entities.values()).filter(
                    (e) => e.project_id === params[0] && e.scene_id === params[1],
                  ),
                };
              }
              return { results: [] };
            },
          };
        },
      };
    },
  };
}

describe("digital-twin", () => {
  it("creates scene and entity", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "u1" };
    const created = await createSpatialScene(env, { name: "Factory floor" }, auth);
    expect(created.ok).toBe(true);
    const entity = await addSpatialEntity(env, auth, created.scene.id, {
      type: "machine",
      position: { x: 1, y: 0, z: 2 },
    });
    expect(entity.ok).toBe(true);
    expect(entity.entity.type).toBe("machine");
  });

  it("grants agent access", async () => {
    const env = { DB: mockDb() };
    const auth = { projectId: "p1", userId: "u1" };
    const created = await createSpatialScene(env, { name: "Lab" }, auth);
    const grant = await grantSpatialAgent(env, auth, created.scene.id, {
      agentId: "agent-1",
      grants: ["view", "interact"],
    });
    expect(grant.ok).toBe(true);
  });
});
