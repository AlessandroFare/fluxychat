import { describe, it, expect } from "vitest";
import { createAROverlayManager } from "./ar-overlay";

describe("createAROverlayManager", () => {
  it("setSpatialAudio stores audio source", () => {
    const ar = createAROverlayManager();
    const src = ar.setSpatialAudio("user-1", {
      position: { x: 1, y: 2, z: 3 }, volume: 0.8, isSpeaking: true,
    });
    expect(src.userId).toBe("user-1");
    expect(src.id).toMatch(/audio-/);
  });

  it("getSpatialAudio retrieves by user id", () => {
    const ar = createAROverlayManager();
    ar.setSpatialAudio("user-1", { position: { x: 0, y: 0, z: 0 }, volume: 0.5, isSpeaking: false });
    const retrieved = ar.getSpatialAudio("user-1");
    expect(retrieved).toBeDefined();
    expect(retrieved!.volume).toBe(0.5);
  });

  it("removeSpatialAudio deletes source", () => {
    const ar = createAROverlayManager();
    ar.setSpatialAudio("user-1", { position: { x: 0, y: 0, z: 0 }, volume: 0.5, isSpeaking: false });
    ar.removeSpatialAudio("user-1");
    expect(ar.getSpatialAudio("user-1")).toBeUndefined();
  });

  it("setPresence and getPresence work", () => {
    const ar = createAROverlayManager();
    ar.setPresence("user-1", { position: { x: 1, y: 2, z: 3 }, avatar: "robot", status: "online", lastSeen: Date.now() });
    const p = ar.getPresence("user-1");
    expect(p).toBeDefined();
    expect(p!.avatar).toBe("robot");
  });

  it("listPresences returns all presences", () => {
    const ar = createAROverlayManager();
    ar.setPresence("u1", { position: { x: 0, y: 0, z: 0 }, avatar: "a", status: "online", lastSeen: 1 });
    ar.setPresence("u2", { position: { x: 1, y: 1, z: 1 }, avatar: "b", status: "away", lastSeen: 2 });
    expect(ar.listPresences()).toHaveLength(2);
  });

  it("addCanvasObject stores object", () => {
    const ar = createAROverlayManager();
    const obj = ar.addCanvasObject({
      type: "text", position: { x: 0, y: 0, z: 0 }, data: { content: "Hello AR" }, createdBy: "user-1",
    });
    expect(obj.id).toMatch(/canvas-/);
    expect(obj.createdAt).toBeGreaterThan(0);
  });

  it("updateCanvasObject modifies object", () => {
    const ar = createAROverlayManager();
    const obj = ar.addCanvasObject({
      type: "shape", position: { x: 0, y: 0, z: 0 }, data: { color: "red" }, createdBy: "user-1",
    });
    const updated = ar.updateCanvasObject(obj.id, { data: { color: "blue" } });
    expect(updated.data.color).toBe("blue");
  });

  it("removeCanvasObject deletes object", () => {
    const ar = createAROverlayManager();
    const obj = ar.addCanvasObject({
      type: "text", position: { x: 0, y: 0, z: 0 }, data: {}, createdBy: "user-1",
    });
    expect(ar.removeCanvasObject(obj.id)).toBe(true);
    expect(ar.getCanvasObjects()).toHaveLength(0);
  });

  it("getCanvasObjects returns all objects", () => {
    const ar = createAROverlayManager();
    ar.addCanvasObject({ type: "text", position: { x: 0, y: 0, z: 0 }, data: {}, createdBy: "u1" });
    ar.addCanvasObject({ type: "image", position: { x: 1, y: 1, z: 1 }, data: {}, createdBy: "u2" });
    expect(ar.getCanvasObjects()).toHaveLength(2);
  });
});
