import { describe, it, expect } from "vitest";

function makeEnv() {
  const rows = [];
  return {
    DB: {
      prepare(sql) {
        let boundParams = [];
        return {
          bind(...params) { boundParams = params; return this; },
          async run() {
            if (sql.includes("INSERT INTO ai_room_configs")) {
              rows.push({ id: boundParams[0], project_id: boundParams[1], room_id: boundParams[2], agent_type: boundParams[3], agent_name: boundParams[4], agent_avatar_url: boundParams[5], agent_system_prompt: boundParams[6], agent_model: boundParams[7], welcome_message: boundParams[8], response_style: boundParams[9], allowed_topics: boundParams[10], escalation_threshold: boundParams[11], auto_resolve_minutes: boundParams[12], embed_enabled: boundParams[13], embed_position: boundParams[14], embed_color: boundParams[15], embed_title: boundParams[16], enabled: 1, created_at: "2026-01-10T00:00:00Z", updated_at: "2026-01-10T00:00:00Z" });
              return { meta: { changes: 1 } };
            }
            if (sql.includes("UPDATE ai_room_configs")) {
              const idx = rows.findIndex(r => r.project_id === boundParams[boundParams.length - 2] && r.room_id === boundParams[boundParams.length - 1]);
              if (idx >= 0) {
                rows[idx].updated_at = "2026-01-10T01:00:00Z";
                if (sql.includes("agent_name")) rows[idx].agent_name = boundParams[0];
                if (sql.includes("agent_system_prompt")) rows[idx].agent_system_prompt = boundParams[0];
                if (sql.includes("agent_model")) rows[idx].agent_model = boundParams[0];
                if (sql.includes("welcome_message")) rows[idx].welcome_message = boundParams[0];
                if (sql.includes("response_style")) rows[idx].response_style = boundParams[0];
                if (sql.includes("embed_enabled")) rows[idx].embed_enabled = boundParams[0];
                if (sql.includes("embed_color")) rows[idx].embed_color = boundParams[0];
                if (sql.includes("embed_title")) rows[idx].embed_title = boundParams[0];
              }
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            if (sql.includes("DELETE FROM ai_room_configs")) {
              const before = rows.length;
              const pidIdx = sql.indexOf("project_id = ?");
              const ridIdx = sql.indexOf("room_id = ?");
              const pid = boundParams[0];
              const rid = boundParams[1];
              for (let i = rows.length - 1; i >= 0; i--) {
                if (rows[i].project_id === pid && rows[i].room_id === rid) rows.splice(i, 1);
              }
              return { meta: { changes: before - rows.length } };
            }
            return { meta: { changes: 1 } };
          },
          async first() {
            const pid = boundParams[0];
            const rid = boundParams[1];
            const r = rows.find(r => r.project_id === pid && r.room_id === rid);
            return r || null;
          },
          async all() {
            const pid = boundParams[0];
            return { results: rows.filter(r => r.project_id === pid).sort((a, b) => b.created_at.localeCompare(a.created_at)) };
          },
        };
      },
    },
  };
}

import {
  createInstantAIRoom,
  getInstantAIRoom,
  listInstantAIRooms,
  updateInstantAIRoom,
  deleteInstantAIRoom,
  getAgentConfig,
} from "./instant-ai-room.js";

describe("P15-H: Instant AI Room", () => {
  const projectId = "proj_air_1";

  it("creates instant AI room with preset", async () => {
    const env = makeEnv();
    const room = await createInstantAIRoom(env, { projectId, agentType: "support" });
    expect(room.id).toBeDefined();
    expect(room.agentType).toBe("support");
    expect(room.agentName).toBe("Support Agent");
    expect(room.embedConfig).toBeDefined();
    expect(room.embedSnippet).toContain("embed.js");
  });

  it("creates room with custom config", async () => {
    const env = makeEnv();
    const room = await createInstantAIRoom(env, {
      projectId, agentType: "sales", agentName: "Bot Sales",
      welcomeMessage: "Benvenuto!", embedColor: "#ff0000",
    });
    expect(room.agentName).toBe("Bot Sales");
    expect(room.welcomeMessage).toBe("Benvenuto!");
    expect(room.embedColor).toBe("#ff0000");
  });

  it("gets AI room config", async () => {
    const env = makeEnv();
    const created = await createInstantAIRoom(env, { projectId, agentType: "faq" });
    const fetched = await getInstantAIRoom(env, { projectId, roomId: created.roomId });
    expect(fetched).not.toBeNull();
    expect(fetched.agentType).toBe("faq");
  });

  it("lists AI rooms", async () => {
    const env = makeEnv();
    await createInstantAIRoom(env, { projectId, agentType: "support" });
    await createInstantAIRoom(env, { projectId, agentType: "sales" });
    const list = await listInstantAIRooms(env, { projectId });
    expect(list.length).toBe(2);
  });

  it("updates AI room", async () => {
    const env = makeEnv();
    const created = await createInstantAIRoom(env, { projectId, agentType: "support" });
    const updated = await updateInstantAIRoom(env, { projectId, roomId: created.roomId, updates: { agentName: "Updated Bot" } });
    expect(updated).not.toBeNull();
    expect(updated.agentName).toBe("Updated Bot");
  });

  it("deletes AI room", async () => {
    const env = makeEnv();
    const created = await createInstantAIRoom(env, { projectId, agentType: "support" });
    const deleted = await deleteInstantAIRoom(env, { projectId, roomId: created.roomId });
    expect(deleted).toBe(true);
    const fetched = await getInstantAIRoom(env, { projectId, roomId: created.roomId });
    expect(fetched).toBeNull();
  });

  it("gets agent config", async () => {
    const env = makeEnv();
    const created = await createInstantAIRoom(env, { projectId, agentType: "onboarding" });
    const agent = await getAgentConfig(env, { projectId, roomId: created.roomId });
    expect(agent).not.toBeNull();
    expect(agent.type).toBe("onboarding");
    expect(agent.systemPrompt).toContain("onboarding");
  });

  it("returns null for unknown room", async () => {
    const env = makeEnv();
    const room = await getInstantAIRoom(env, { projectId, roomId: "unknown" });
    expect(room).toBeNull();
  });
});
