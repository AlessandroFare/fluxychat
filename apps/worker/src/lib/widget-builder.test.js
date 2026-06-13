import { describe, it, expect } from "vitest";
import {
  createWidget, updateWidget, getWidget, getWidgetBySlug, listWidgets, deleteWidget,
  createFlow, listFlows, deleteFlow,
  createTheme, listThemes,
  recordEvent, getWidgetAnalytics, getWidgetStats,
} from "./widget-builder.js";

function makeEnv() {
  const widgets = [];
  const flows = [];
  const themes = [];
  const events = [];
  return {
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          first: async () => {
            if (sql.includes("widget_configs") && sql.includes("slug") && sql.includes("enabled")) {
              return widgets.find((w) => w.slug === params[0] && w.project_id === params[1] && w.enabled) || null;
            }
            if (sql.includes("widget_configs") && sql.includes("WHERE id")) {
              return widgets.find((w) => w.id === params[0] && w.project_id === params[1]) || null;
            }
            return null;
          },
          all: async () => {
            if (sql.includes("GROUP BY type")) {
              const groups = {};
              for (const w of widgets.filter((w) => w.project_id === params[0])) {
                if (!groups[w.type]) groups[w.type] = { type: w.type, count: 0, views: 0, interactions: 0 };
                groups[w.type].count++;
                groups[w.type].views += w.view_count;
                groups[w.type].interactions += w.interaction_count;
              }
              return { results: Object.values(groups) };
            }
            if (sql.includes("GROUP BY event_type")) {
              const filtered = events.filter((e) => e.project_id === params[0]);
              const groups = {};
              for (const e of filtered) {
                groups[e.event_type] = (groups[e.event_type] || 0) + 1;
              }
              return { results: Object.entries(groups).map(([event_type, count]) => ({ event_type, count })) };
            }
            if (sql.includes("widget_configs")) return { results: widgets.filter((w) => w.project_id === params[0]) };
            if (sql.includes("widget_flows")) return { results: flows.filter((f) => f.widget_id === params[0]) };
            if (sql.includes("widget_themes")) return { results: themes.filter((t) => t.project_id === params[0] || t.is_system) };
            return { results: [] };
          },
          run: async () => {
            if (sql.includes("INSERT INTO widget_configs")) {
              const exists = widgets.find((w) => w.project_id === params[1] && w.slug === params[3]);
              if (exists) throw new Error("UNIQUE constraint");
              widgets.push({ id: params[0], project_id: params[1], name: params[2], slug: params[3], agent_id: params[4], type: params[5], theme: params[6], position: params[7], greeting: params[8], fallback_message: params[9], allowed_origins: params[10], embed_code: params[11], enabled: 1, view_count: 0, interaction_count: 0, created_at: params[12], updated_at: params[13] });
            } else if (sql.includes("INSERT INTO widget_flows")) {
              flows.push({ id: params[0], widget_id: params[1], project_id: params[2], name: params[3], trigger_type: params[4], trigger_value: params[5], steps: params[6], enabled: 1, sort_order: 0, created_at: params[7] });
            } else if (sql.includes("INSERT INTO widget_themes")) {
              themes.push({ id: params[0], project_id: params[1], name: params[2], primary_color: params[3], secondary_color: params[4], background_color: params[5], text_color: params[6], font_family: params[7], border_radius: params[8], bubble_size: params[9], custom_css: params[10], is_system: params[11], created_at: params[12] });
            } else if (sql.includes("INSERT INTO widget_analytics")) {
              events.push({ id: params[0], widget_id: params[1], project_id: params[2], event_type: params[3], session_id: params[4], metadata: params[5], recorded_at: params[6] });
            } else if (sql.includes("DELETE FROM widget_configs")) {
              const before = widgets.length;
              for (let i = widgets.length - 1; i >= 0; i--) { if (widgets[i].id === params[0] && widgets[i].project_id === params[1]) widgets.splice(i, 1); }
              return { meta: { changes: before - widgets.length } };
            } else if (sql.includes("DELETE FROM widget_flows")) {
              const before = flows.length;
              for (let i = flows.length - 1; i >= 0; i--) { if (flows[i].id === params[0]) flows.splice(i, 1); }
              return { meta: { changes: before - flows.length } };
            } else if (sql.includes("UPDATE widget_configs") && sql.includes("view_count")) {
              const w = widgets.find((w) => w.id === params[0]);
              if (w) w.view_count++;
            } else if (sql.includes("UPDATE widget_configs") && sql.includes("interaction_count")) {
              const w = widgets.find((w) => w.id === params[0]);
              if (w) w.interaction_count++;
            } else if (sql.includes("UPDATE widget_configs")) {
              const idx = widgets.findIndex((w) => w.id === params[params.length - 2] && w.project_id === params[params.length - 1]);
              if (idx >= 0 && sql.includes("name = ?")) widgets[idx].name = params[1];
              return { meta: { changes: idx >= 0 ? 1 : 0 } };
            }
            return { meta: { changes: 1 } };
          },
        }),
      }),
    },
    _widgets: widgets,
    _flows: flows,
    _themes: themes,
    _events: events,
  };
}

describe("widget-builder", () => {
  describe("createWidget", () => {
    it("creates a widget with embed code", async () => {
      const env = makeEnv();
      const result = await createWidget(env, { projectId: "p1", name: "Support", slug: "support" });
      expect(result.created).toBe(true);
      expect(result.embedCode).toContain("data-widget-id");
    });

    it("requires name and slug", async () => {
      const env = makeEnv();
      const result = await createWidget(env, { projectId: "p1" });
      expect(result.error).toContain("required");
    });

    it("validates type", async () => {
      const env = makeEnv();
      const result = await createWidget(env, { projectId: "p1", name: "x", slug: "x", type: "modal" });
      expect(result.error).toContain("type");
    });

    it("rejects duplicate slug", async () => {
      const env = makeEnv();
      await createWidget(env, { projectId: "p1", name: "A", slug: "w" });
      const result = await createWidget(env, { projectId: "p1", name: "B", slug: "w" });
      expect(result.error).toContain("already_exists");
    });
  });

  describe("flows", () => {
    it("creates a flow", async () => {
      const env = makeEnv();
      const result = await createFlow(env, { widgetId: "w1", projectId: "p1", name: "Greeting", triggerType: "greeting" });
      expect(result.created).toBe(true);
    });

    it("validates triggerType", async () => {
      const env = makeEnv();
      const result = await createFlow(env, { widgetId: "w1", projectId: "p1", name: "x", triggerType: "invalid" });
      expect(result.error).toContain("triggerType");
    });
  });

  describe("themes", () => {
    it("creates a theme", async () => {
      const env = makeEnv();
      const result = await createTheme(env, { projectId: "p1", name: "Blue", primaryColor: "#0066ff" });
      expect(result.created).toBe(true);
    });
  });

  describe("analytics", () => {
    it("records events and updates counters", async () => {
      const env = makeEnv();
      await createWidget(env, { projectId: "p1", name: "W", slug: "w" });
      const w = env._widgets[0];
      await recordEvent(env, { widgetId: w.id, projectId: "p1", eventType: "view" });
      await recordEvent(env, { widgetId: w.id, projectId: "p1", eventType: "message" });
      expect(w.view_count).toBe(1);
      expect(w.interaction_count).toBe(1);
    });

    it("validates eventType", async () => {
      const env = makeEnv();
      const result = await recordEvent(env, { widgetId: "w1", projectId: "p1", eventType: "invalid" });
      expect(result.error).toContain("eventType");
    });
  });

  describe("getWidgetStats", () => {
    it("returns stats", async () => {
      const env = makeEnv();
      await createWidget(env, { projectId: "p1", name: "A", slug: "a", type: "chat" });
      await createWidget(env, { projectId: "p1", name: "B", slug: "b", type: "popup" });
      const stats = await getWidgetStats(env, { projectId: "p1" });
      expect(stats.totalWidgets).toBe(2);
    });
  });
});
