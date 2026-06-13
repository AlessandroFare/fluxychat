import { describe, it, expect } from "vitest";
import {
  createTemplate, getTemplate, listTemplates, deleteTemplate,
  submitUpdate, listUpdates, getUnsyncedUpdates, markSynced,
} from "../lib/field-ops.js";

function mockDb(rows = []) {
  const run = async () => ({ meta: { changes: 1 } });
  const first = async () => rows[0] || null;
  const all = async () => ({ results: rows });
  return { prepare: () => ({ bind: () => ({ run, first, all }) }) };
}

describe("field-ops", () => {
  describe("createTemplate", () => {
    it("creates template", async () => {
      const env = { DB: mockDb() };
      const tpl = await createTemplate(env, {
        projectId: "p1", name: "Safety Inspection",
        templateType: "safety", fields: [{ name: "fire_extinguisher", type: "boolean" }],
        safetyAlerts: true, photoRequired: true,
      });
      expect(tpl.id).toBeDefined();
      expect(tpl.templateType).toBe("safety");
    });
    it("rejects invalid type", async () => {
      const env = { DB: mockDb() };
      await expect(createTemplate(env, { projectId: "p1", name: "x", templateType: "bad" }))
        .rejects.toThrow("Invalid template type");
    });
  });

  describe("listTemplates", () => {
    it("lists templates", async () => {
      const env = { DB: mockDb([
        { id: "t1", project_id: "p1", name: "Checklist", description: null, template_type: "checklist", fields: "[]", safety_alerts: 0, photo_required: 0, offline_queue: 1, enabled: 1, created_at: "2026-01-01" },
      ])};
      const tpls = await listTemplates(env, { projectId: "p1" });
      expect(tpls).toHaveLength(1);
    });
  });

  describe("getTemplate", () => {
    it("returns template", async () => {
      const env = { DB: mockDb([{
        id: "t1", project_id: "p1", name: "Safety", description: null,
        template_type: "safety", fields: '[{"name":"fire","type":"boolean"}]',
        safety_alerts: 1, photo_required: 1, offline_queue: 1, enabled: 1, created_at: "2026-01-01",
      }])};
      const tpl = await getTemplate(env, { projectId: "p1", templateId: "t1" });
      expect(tpl.name).toBe("Safety");
      expect(tpl.safetyAlerts).toBe(true);
      expect(tpl.fields).toHaveLength(1);
    });
  });

  describe("submitUpdate", () => {
    it("submits update", async () => {
      const env = { DB: mockDb() };
      const upd = await submitUpdate(env, {
        projectId: "p1", roomId: "r1", userId: "u1",
        updateType: "status", content: "All clear",
      });
      expect(upd.id).toBeDefined();
      expect(upd.synced).toBe(true);
    });
  });

  describe("listUpdates", () => {
    it("lists updates", async () => {
      const env = { DB: mockDb([
        { id: "u1", template_id: "t1", project_id: "p1", room_id: "r1", user_id: "u1", update_type: "status", content: "OK", photo_url: null, metadata: "{}", synced: 1, created_at: "2026-01-01" },
      ])};
      const upds = await listUpdates(env, { projectId: "p1", roomId: "r1" });
      expect(upds).toHaveLength(1);
    });
  });

  describe("getUnsyncedUpdates", () => {
    it("returns unsynced", async () => {
      const env = { DB: mockDb([
        { id: "u1", template_id: null, project_id: "p1", room_id: "r1", user_id: "u1", update_type: "status", content: "Offline update", photo_url: null, metadata: "{}", synced: 0, created_at: "2026-01-01" },
      ])};
      const upds = await getUnsyncedUpdates(env, { projectId: "p1" });
      expect(upds).toHaveLength(1);
      expect(upds[0].synced).toBe(false);
    });
  });

  describe("markSynced", () => {
    it("marks synced", async () => {
      const env = { DB: mockDb() };
      const ok = await markSynced(env, { projectId: "p1", updateId: "u1" });
      expect(ok).toBe(true);
    });
  });

  describe("deleteTemplate", () => {
    it("deletes template", async () => {
      const env = { DB: mockDb() };
      const ok = await deleteTemplate(env, { projectId: "p1", templateId: "t1" });
      expect(ok).toBe(true);
    });
  });
});
