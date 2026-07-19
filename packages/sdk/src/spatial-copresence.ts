export interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}

export interface SpatialParticipant {
  userId: string;
  position: SpatialPosition;
  label?: string;
  lastActive: string;
}

export interface SpatialRoomConfig {
  id: string;
  name: string;
  dimensions?: { width: number; height: number; depth: number };
}

export interface SpatialCopresenceApi {
  createRoom(config: SpatialRoomConfig): SpatialRoomConfig;
  getRoom(id: string): SpatialRoomConfig | null;
  join(roomId: string, userId: string, position?: SpatialPosition): void;
  leave(roomId: string, userId: string): void;
  updatePosition(roomId: string, userId: string, position: SpatialPosition): void;
  getParticipants(roomId: string): SpatialParticipant[];
  getNearby(roomId: string, userId: string, radius: number): SpatialParticipant[];
  listRooms(): SpatialRoomConfig[];
}

export function createSpatialCopresence(): SpatialCopresenceApi {
  const spatialRooms = new Map<string, SpatialRoomConfig>();
  const spatialParticipants = new Map<string, Map<string, SpatialParticipant>>();
  return {
    createRoom(config) { spatialRooms.set(config.id, config); return config; },
    getRoom(id) { return spatialRooms.get(id) ?? null; },
    join(roomId, userId, position) {
      if (!spatialRooms.has(roomId)) throw new Error(`Room not found: ${roomId}`);
      const room = spatialParticipants.get(roomId) ?? new Map();
      room.set(userId, { userId, position: position ?? { x: 0, y: 0, z: 0 }, lastActive: new Date().toISOString() });
      spatialParticipants.set(roomId, room);
    },
    leave(roomId, userId) {
      const room = spatialParticipants.get(roomId);
      if (room) room.delete(userId);
    },
    updatePosition(roomId, userId, position) {
      const room = spatialParticipants.get(roomId);
      const p = room?.get(userId);
      if (p) { p.position = position; p.lastActive = new Date().toISOString(); }
    },
    getParticipants(roomId) { return [...(spatialParticipants.get(roomId)?.values() ?? [])]; },
    getNearby(roomId, userId, radius) {
      const room = spatialParticipants.get(roomId);
      if (!room) return [];
      const self = room.get(userId);
      if (!self) return [];
      const nearby: SpatialParticipant[] = [];
      for (const [, p] of room) {
        if (p.userId === userId) continue;
        const dist = Math.sqrt((p.position.x - self.position.x) ** 2 + (p.position.y - self.position.y) ** 2 + (p.position.z - self.position.z) ** 2);
        if (dist <= radius) nearby.push(p);
      }
      return nearby;
    },
    listRooms() { return [...spatialRooms.values()]; },
  };
}
