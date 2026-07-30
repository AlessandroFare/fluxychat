export interface SpatialAudioSource {
  id: string;
  userId: string;
  position: { x: number; y: number; z: number };
  volume: number;
  isSpeaking: boolean;
}

export interface ARPresence {
  userId: string;
  position: { x: number; y: number; z: number };
  avatar: string;
  status: "online" | "away" | "offline";
  lastSeen: number;
}

export interface ARCanvasObject {
  id: string;
  type: "text" | "shape" | "image" | "drawing";
  position: { x: number; y: number; z: number };
  data: Record<string, unknown>;
  createdBy: string;
  createdAt: number;
}

export interface AROverlayManager {
  setSpatialAudio(userId: string, source: Omit<SpatialAudioSource, "id">): SpatialAudioSource;
  getSpatialAudio(userId: string): SpatialAudioSource | undefined;
  removeSpatialAudio(userId: string): void;
  setPresence(userId: string, presence: Omit<ARPresence, "userId">): ARPresence;
  getPresence(userId: string): ARPresence | undefined;
  listPresences(): ARPresence[];
  addCanvasObject(obj: Omit<ARCanvasObject, "id" | "createdAt">): ARCanvasObject;
  updateCanvasObject(objectId: string, updates: Partial<ARCanvasObject>): ARCanvasObject;
  removeCanvasObject(objectId: string): boolean;
  getCanvasObjects(): ARCanvasObject[];
}

export function createAROverlayManager(): AROverlayManager {
  const audioSources = new Map<string, SpatialAudioSource>();
  const presences = new Map<string, ARPresence>();
  const canvasObjects = new Map<string, ARCanvasObject>();
  let audioCounter = 0;
  let canvasCounter = 0;

  return {
    setSpatialAudio(userId, source) {
      const id = `audio-${++audioCounter}`;
      const entry: SpatialAudioSource = { ...source, id, userId };
      audioSources.set(userId, entry);
      return { ...entry };
    },

    getSpatialAudio(userId) {
      const s = audioSources.get(userId);
      return s ? { ...s } : undefined;
    },

    removeSpatialAudio(userId) {
      audioSources.delete(userId);
    },

    setPresence(userId, presence) {
      const entry: ARPresence = { ...presence, userId };
      presences.set(userId, entry);
      return { ...entry };
    },

    getPresence(userId) {
      const p = presences.get(userId);
      return p ? { ...p } : undefined;
    },

    listPresences() {
      return Array.from(presences.values()).map((p) => ({ ...p }));
    },

    addCanvasObject(obj) {
      const id = `canvas-${++canvasCounter}`;
      const entry: ARCanvasObject = { ...obj, id, createdAt: Date.now() };
      canvasObjects.set(id, entry);
      return { ...entry };
    },

    updateCanvasObject(objectId, updates) {
      const obj = canvasObjects.get(objectId);
      if (!obj) throw new Error(`Canvas object "${objectId}" not found`);
      Object.assign(obj, updates);
      return { ...obj };
    },

    removeCanvasObject(objectId) {
      return canvasObjects.delete(objectId);
    },

    getCanvasObjects() {
      return Array.from(canvasObjects.values()).map((o) => ({ ...o }));
    },
  };
}
