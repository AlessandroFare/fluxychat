import { describe, it, expect } from "vitest";
import { createSpatialCopresence } from "./spatial-copresence";

describe("createSpatialCopresence", () => {
  it("creates and retrieves room", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "room-1", name: "Lobby" });
    expect(sc.getRoom("room-1")?.name).toBe("Lobby");
  });

  it("join adds participant", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "room-1", name: "Lobby" });
    sc.join("room-1", "user-1", { x: 10, y: 20, z: 0 });
    expect(sc.getParticipants("room-1")).toHaveLength(1);
  });

  it("leave removes participant", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "room-1", name: "Lobby" });
    sc.join("room-1", "user-1");
    sc.leave("room-1", "user-1");
    expect(sc.getParticipants("room-1")).toHaveLength(0);
  });

  it("updatePosition changes location", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "room-1", name: "Lobby" });
    sc.join("room-1", "user-1", { x: 0, y: 0, z: 0 });
    sc.updatePosition("room-1", "user-1", { x: 100, y: 200, z: 0 });
    const p = sc.getParticipants("room-1")[0];
    expect(p.position.x).toBe(100);
  });

  it("getNearby returns participants within radius", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "room-1", name: "Lobby" });
    sc.join("room-1", "user-1", { x: 0, y: 0, z: 0 });
    sc.join("room-1", "user-2", { x: 5, y: 0, z: 0 });
    sc.join("room-1", "user-3", { x: 100, y: 0, z: 0 });
    expect(sc.getNearby("room-1", "user-1", 10)).toHaveLength(1);
    expect(sc.getNearby("room-1", "user-1", 10)[0].userId).toBe("user-2");
  });

  it("listRooms returns all rooms", () => {
    const sc = createSpatialCopresence();
    sc.createRoom({ id: "r1", name: "A" });
    sc.createRoom({ id: "r2", name: "B" });
    expect(sc.listRooms()).toHaveLength(2);
  });
});
