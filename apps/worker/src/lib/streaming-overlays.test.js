import { describe, it, expect } from "vitest";
import {
  createOverlay, getOverlay, listOverlays, deleteOverlay, getOverlayWidget,
  parseOverlayPatch, updateOverlay,
} from "../lib/streaming-overlays.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return { prepare: () => ({ bind: () => ({ run, first, all }) }) };
}

describe("streaming-overlays", () => {
  describe("createOverlay", () => {
    it("creates overlay", async () => {
      const env = { DB: mockDb() };
      const ov = await createOverlay(env, {
        projectId: "p1", roomId: "r1", name: "Q&A Overlay",
        overlayType: "qa", style: { bgColor: "#000", textColor: "#fff" },
      });
      expect(ov.id).toBeDefined();
      expect(ov.overlayType).toBe("qa");
    });
    it("rejects invalid type", async () => {
      const env = { DB: mockDb() };
      await expect(createOverlay(env, { projectId: "p1", roomId: "r1", name: "x", overlayType: "invalid" }))
        .rejects.toThrow("Invalid overlay type");
    });
  });

  describe("getOverlay", () => {
    it("returns overlay", async () => {
      const env = { DB: mockDb([{
        id: "o1", project_id: "p1", room_id: "r1", name: "Q&A",
        overlay_type: "qa", config: "{}", style: '{"bg":"#000"}',
        refresh_seconds: 30, enabled: 1, created_at: "2026-01-01",
      }])};
      const ov = await getOverlay(env, { projectId: "p1", overlayId: "o1" });
      expect(ov.name).toBe("Q&A");
      expect(ov.style.bg).toBe("#000");
    });
  });

  describe("listOverlays", () => {
    it("lists overlays", async () => {
      const env = { DB: mockDb([
        { id: "o1", project_id: "p1", room_id: "r1", name: "A", overlay_type: "qa", config: "{}", style: "{}", refresh_seconds: 30, enabled: 1, created_at: "2026-01-01" },
      ])};
      const ovs = await listOverlays(env, { projectId: "p1" });
      expect(ovs).toHaveLength(1);
    });
  });

  describe("getOverlayWidget", () => {
    it("returns widget config", async () => {
      const env = { DB: mockDb([{
        id: "o1", project_id: "p1", room_id: "r1", name: "Q&A",
        overlay_type: "qa", config: "{}", style: "{}",
        refresh_seconds: 15, enabled: 1, created_at: "2026-01-01",
      }])};
      const widget = await getOverlayWidget(env, { projectId: "p1", overlayId: "o1" });
      expect(widget.type).toBe("qa");
      expect(widget.refreshSeconds).toBe(15);
      expect(widget.widgetUrl).toContain("/widget");
    });
    it("loads OBS widget by overlay id without a project", async () => {
      const env = { DB: mockDb([{
        id: "o1", project_id: "p1", room_id: "r1", name: "Chat",
        overlay_type: "chat", config: "{}", style: "{}",
        refresh_seconds: 5, enabled: 1, created_at: "2026-01-01",
      }]) };
      const widget = await getOverlayWidget(env, { overlayId: "o1" });
      expect(widget.type).toBe("chat");
    });
    it("returns null for missing", async () => {
      const env = { DB: mockDb([]) };
      const widget = await getOverlayWidget(env, { projectId: "p1", overlayId: "missing" });
      expect(widget).toBeNull();
    });
    it("hides the OBS widget when disabled", async () => {
      const env = { DB: mockDb([{
        id: "o1", project_id: "p1", room_id: "r1", name: "Chat",
        overlay_type: "chat", config: "{}", style: "{}",
        refresh_seconds: 5, enabled: 0, created_at: "2026-01-01",
      }]) };
      expect(await getOverlayWidget(env, { overlayId: "o1" })).toBeNull();
    });
  });

  describe("updateOverlay", () => {
    it("rejects an empty patch", () => {
      expect(parseOverlayPatch({})).toEqual({ ok: false, error: "no fields to update" });
    });
    it("persists enabled false", async () => {
      const env = { DB: mockDb([{
        id: "o1", project_id: "p1", room_id: "r1", name: "Chat",
        overlay_type: "chat", config: "{}", style: '{"opacity":0.5}',
        refresh_seconds: 5, enabled: 0, created_at: "2026-01-01",
      }]) };
      const out = await updateOverlay(env, { projectId: "p1", overlayId: "o1", data: { enabled: false } });
      expect(out.ok).toBe(true);
      expect(out.overlay.enabled).toBe(false);
    });
  });

  describe("deleteOverlay", () => {
    it("deletes overlay", async () => {
      const env = { DB: mockDb() };
      const ok = await deleteOverlay(env, { projectId: "p1", overlayId: "o1" });
      expect(ok).toBe(true);
    });
  });
});
