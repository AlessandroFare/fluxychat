import { describe, it, expect } from "vitest";
import {
  createWorkspace, getWorkspace, updateWorkspace,
  addTab, removeTab, listTabs,
  pinItem, unpinItem, listPins,
  createTemplate, listTemplates, applyTemplate, getWorkspaceStats,
} from "./ai-workspace.js";

function makeEnv() {
  const configs = [];
  const tabs = [];
  const pins = [];
  const templates = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("workspace_configs") && !sql.includes("GROUP")) {
              return configs.find((c) => c.project_id === params[0] && c.room_id === params[1]) || null;
            }
            if (sql.includes("workspace_templates")) {
              return templates.find((t) => t.id === params[0] && (t.project_id === params[1] || t.is_system)) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY knowledge_scope")) {
              const groups = {};
              for (const c of configs.filter((c) => c.project_id === params[0])) {
                const key = c.knowledge_scope;
                groups[key] = (groups[key] || 0) + 1;
              }
              return { results: Object.entries(groups).map(([knowledge_scope, count]) => ({ knowledge_scope, count })) };
            }
            if (sql.includes("GROUP BY tab_type")) {
              const groups = {};
              for (const t of tabs) {
                const c = configs.find((c) => c.id === t.workspace_id);
                if (c && c.project_id === params[0]) {
                  groups[t.tab_type] = (groups[t.tab_type] || 0) + 1;
                }
              }
              return { results: Object.entries(groups).map(([tab_type, count]) => ({ tab_type, count })) };
            }
            if (sql.includes("GROUP BY item_type")) {
              const groups = {};
              for (const p of pins) {
                const c = configs.find((c) => c.id === p.workspace_id);
                if (c && c.project_id === params[0]) {
                  groups[p.item_type] = (groups[p.item_type] || 0) + 1;
                }
              }
              return { results: Object.entries(groups).map(([item_type, count]) => ({ item_type, count })) };
            }
            if (sql.includes("workspace_tabs") && sql.includes("workspace_id")) return { results: tabs.filter((t) => t.workspace_id === params[0]) };
            if (sql.includes("workspace_pins") && sql.includes("workspace_id")) return { results: pins.filter((p) => p.workspace_id === params[0]) };
            if (sql.includes("workspace_templates")) return { results: templates.filter((t) => t.project_id === params[0] || t.is_system) };
            return { results: [] };
          },
          run: async () => {
            if (sql.includes("INSERT INTO workspace_configs")) {
              const exists = configs.find((c) => c.project_id === params[1] && c.room_id === params[2]);
              if (exists) throw new Error("UNIQUE constraint");
              configs.push({ id: params[0], project_id: params[1], room_id: params[2], name: params[3], description: params[4], tabs: params[5], agent_id: params[6], knowledge_scope: params[7], settings: params[8], created_at: params[9], updated_at: params[10] });
            } else if (sql.includes("INSERT INTO workspace_tabs")) {
              tabs.push({ id: params[0], workspace_id: params[1], tab_type: params[2], label: params[3], icon: params[4], sort_order: params[5], config: params[6], enabled: params[7], created_at: params[8] });
            } else if (sql.includes("INSERT INTO workspace_pins")) {
              pins.push({ id: params[0], workspace_id: params[1], item_type: params[2], item_id: params[3], pinned_by: params[4], note: params[5], created_at: params[6] });
            } else if (sql.includes("INSERT INTO workspace_templates")) {
              templates.push({ id: params[0], project_id: params[1], name: params[2], description: params[3], tabs: params[4], agent_config: params[5], settings: params[6], is_system: params[7], use_count: 0, created_at: params[8] });
            } else if (sql.includes("DELETE FROM workspace_tabs")) {
              const before = tabs.length;
              for (let i = tabs.length - 1; i >= 0; i--) { if (tabs[i].id === params[0]) tabs.splice(i, 1); }
              return { meta: { changes: before - tabs.length } };
            } else if (sql.includes("DELETE FROM workspace_pins")) {
              const before = pins.length;
              for (let i = pins.length - 1; i >= 0; i--) { if (pins[i].id === params[0]) pins.splice(i, 1); }
              return { meta: { changes: before - pins.length } };
            } else if (sql.includes("UPDATE workspace_configs")) {
              const idx = configs.findIndex((c) => c.id === params[params.length - 2] && c.project_id === params[params.length - 1]);
              if (idx >= 0 && sql.includes("name = ?")) configs[idx].name = params[1];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            } else if (sql.includes("UPDATE workspace_templates")) {
              const t = templates.find((t) => t.id === params[params.length - 1]);
              if (t) t.use_count++;
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _configs: configs,
    _tabs: tabs,
    _pins: pins,
  };
}

describe("ai-workspace", () => {
  describe("createWorkspace", () => {
    it("creates a workspace with default tabs", async () => {
      const env = makeEnv();
      const result = await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "Support" });
      expect(result.created).toBe(true);
    });

    it("rejects duplicate workspace for same room", async () => {
      const env = makeEnv();
      await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "A" });
      const result = await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "B" });
      expect(result.error).toContain("already_exists");
    });
  });

  describe("getWorkspace", () => {
    it("returns workspace with tabs and pins", async () => {
      const env = makeEnv();
      await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "WS", tabs: ["chat", "tasks", "knowledge"] });
      const ws = await getWorkspace(env, { projectId: "p1", roomId: "r1" });
      expect(ws).not.toBeNull();
      expect(ws.tabs.length).toBe(3);
      expect(ws.tabs[0].tabType).toBe("chat");
    });

    it("returns null for non-existent", async () => {
      const env = makeEnv();
      const ws = await getWorkspace(env, { projectId: "p1", roomId: "r99" });
      expect(ws).toBeNull();
    });
  });

  describe("addTab", () => {
    it("adds a custom tab", async () => {
      const env = makeEnv();
      await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "WS" });
      const ws = await getWorkspace(env, { projectId: "p1", roomId: "r1" });
      const result = await addTab(env, { workspaceId: ws.id, tabType: "agent", label: "AI Agent" });
      expect(result.created).toBe(true);
    });

    it("validates tabType", async () => {
      const env = makeEnv();
      const result = await addTab(env, { workspaceId: "ws1", tabType: "invalid" });
      expect(result.error).toContain("tabType");
    });
  });

  describe("pinItem", () => {
    it("pins a message", async () => {
      const env = makeEnv();
      await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "WS" });
      const ws = await getWorkspace(env, { projectId: "p1", roomId: "r1" });
      const result = await pinItem(env, { workspaceId: ws.id, itemType: "message", itemId: "m1", pinnedBy: "user1" });
      expect(result.created).toBe(true);
    });

    it("validates itemType", async () => {
      const env = makeEnv();
      const result = await pinItem(env, { workspaceId: "ws1", itemType: "invalid", itemId: "x", pinnedBy: "u" });
      expect(result.error).toContain("itemType");
    });
  });

  describe("templates", () => {
    it("creates and applies a template", async () => {
      const env = makeEnv();
      const tpl = await createTemplate(env, { projectId: "p1", name: "Support WS", tabs: ["chat", "tasks", "knowledge"] });
      expect(tpl.created).toBe(true);

      const result = await applyTemplate(env, { templateId: tpl.id, projectId: "p1", roomId: "r2" });
      expect(result.created).toBe(true);
    });
  });

  describe("getWorkspaceStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createWorkspace(env, { projectId: "p1", roomId: "r1", name: "A", tabs: ["chat", "tasks"] });
      await createWorkspace(env, { projectId: "p1", roomId: "r2", name: "B", tabs: ["chat", "knowledge"] });
      const stats = await getWorkspaceStats(env, { projectId: "p1" });
      expect(stats.totalWorkspaces).toBe(2);
      expect(stats.byTabType.chat).toBe(2);
    });
  });
});
