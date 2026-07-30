import { describe, it, expect } from "vitest";
import { createDigitalTwinRoom } from "./digital-twin";

describe("createDigitalTwinRoom", () => {
  it("creates and retrieves a scene", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Office", { floor: 1 });
    expect(scene.name).toBe("Office");
    expect(dtr.getScene(scene.id)!.name).toBe("Office");
  });

  it("listScenes returns all scenes", () => {
    const dtr = createDigitalTwinRoom();
    dtr.createScene("A");
    dtr.createScene("B");
    expect(dtr.listScenes()).toHaveLength(2);
  });

  it("addEntity adds entity to scene", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Room");
    const entity = dtr.addEntity(scene.id, {
      type: "desk", position: { x: 1, y: 0, z: 2 }, properties: { color: "brown" },
    });
    expect(entity.id).toMatch(/ent-/);
    expect(entity.type).toBe("desk");
  });

  it("updateEntity modifies entity", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Room");
    const entity = dtr.addEntity(scene.id, { type: "desk", position: { x: 0, y: 0, z: 0 }, properties: {} });
    const updated = dtr.updateEntity(scene.id, entity.id, { position: { x: 5, y: 0, z: 5 } });
    expect(updated.position.x).toBe(5);
  });

  it("removeEntity removes entity from scene", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Room");
    const entity = dtr.addEntity(scene.id, { type: "desk", position: { x: 0, y: 0, z: 0 }, properties: {} });
    expect(dtr.removeEntity(scene.id, entity.id)).toBe(true);
    expect(dtr.getEntity(scene.id, entity.id)).toBeUndefined();
  });

  it("grantAgentAccess and checkAgentAccess control permissions", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Room");
    dtr.grantAgentAccess(scene.id, { agentId: "agent-1", grants: ["view", "interact"] });
    expect(dtr.checkAgentAccess(scene.id, "agent-1", "view")).toBe(true);
    expect(dtr.checkAgentAccess(scene.id, "agent-1", "modify")).toBe(false);
  });

  it("deleteScene removes scene and grants", () => {
    const dtr = createDigitalTwinRoom();
    const scene = dtr.createScene("Room");
    dtr.grantAgentAccess(scene.id, { agentId: "a1", grants: ["view"] });
    expect(dtr.deleteScene(scene.id)).toBe(true);
    expect(dtr.getScene(scene.id)).toBeUndefined();
  });
});
