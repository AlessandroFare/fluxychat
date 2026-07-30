export interface SpatialEntity {
  id: string;
  type: string;
  position: { x: number; y: number; z: number };
  rotation?: { x: number; y: number; z: number };
  properties: Record<string, unknown>;
}

export interface SpatialSceneState {
  id: string;
  name: string;
  entities: SpatialEntity[];
  metadata: Record<string, unknown>;
  updatedAt: number;
}

export type GrantType = "view" | "interact" | "modify" | "admin";

export interface AgentSpatialGrant {
  agentId: string;
  grants: GrantType[];
  entityFilter?: string[];
}

export interface DigitalTwinRoom {
  createScene(name: string, metadata?: Record<string, unknown>): SpatialSceneState;
  getScene(sceneId: string): SpatialSceneState | undefined;
  listScenes(): SpatialSceneState[];
  addEntity(sceneId: string, entity: Omit<SpatialEntity, "id">): SpatialEntity;
  updateEntity(sceneId: string, entityId: string, updates: Partial<SpatialEntity>): SpatialEntity;
  removeEntity(sceneId: string, entityId: string): boolean;
  getEntity(sceneId: string, entityId: string): SpatialEntity | undefined;
  grantAgentAccess(sceneId: string, grant: AgentSpatialGrant): void;
  checkAgentAccess(sceneId: string, agentId: string, grant: GrantType): boolean;
  deleteScene(sceneId: string): boolean;
}

export function createDigitalTwinRoom(): DigitalTwinRoom {
  const scenes = new Map<string, SpatialSceneState>();
  const grants = new Map<string, Map<string, Set<GrantType>>>();
  let sceneCounter = 0;
  let entityCounter = 0;

  return {
    createScene(name, metadata = {}) {
      const id = `scene-${++sceneCounter}`;
      const scene: SpatialSceneState = { id, name, entities: [], metadata, updatedAt: Date.now() };
      scenes.set(id, scene);
      grants.set(id, new Map());
      return { ...scene, entities: [] };
    },

    getScene(sceneId) {
      const s = scenes.get(sceneId);
      return s ? { ...s, entities: [...s.entities] } : undefined;
    },

    listScenes() {
      return Array.from(scenes.values()).map((s) => ({ ...s, entities: [...s.entities] }));
    },

    addEntity(sceneId, input) {
      const scene = scenes.get(sceneId);
      if (!scene) throw new Error(`Scene "${sceneId}" not found`);
      const entity: SpatialEntity = { ...input, id: `ent-${++entityCounter}` };
      scene.entities.push(entity);
      scene.updatedAt = Date.now();
      return { ...entity };
    },

    updateEntity(sceneId, entityId, updates) {
      const scene = scenes.get(sceneId);
      if (!scene) throw new Error(`Scene "${sceneId}" not found`);
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) throw new Error(`Entity "${entityId}" not found`);
      scene.entities[idx] = { ...scene.entities[idx], ...updates };
      scene.updatedAt = Date.now();
      return { ...scene.entities[idx] };
    },

    removeEntity(sceneId, entityId) {
      const scene = scenes.get(sceneId);
      if (!scene) return false;
      const idx = scene.entities.findIndex((e) => e.id === entityId);
      if (idx === -1) return false;
      scene.entities.splice(idx, 1);
      scene.updatedAt = Date.now();
      return true;
    },

    getEntity(sceneId, entityId) {
      const scene = scenes.get(sceneId);
      if (!scene) return undefined;
      const entity = scene.entities.find((e) => e.id === entityId);
      return entity ? { ...entity } : undefined;
    },

    grantAgentAccess(sceneId, grant) {
      const sceneGrants = grants.get(sceneId);
      if (!sceneGrants) throw new Error(`Scene "${sceneId}" not found`);
      sceneGrants.set(grant.agentId, new Set(grant.grants));
    },

    checkAgentAccess(sceneId, agentId, grant) {
      const sceneGrants = grants.get(sceneId);
      if (!sceneGrants) return false;
      const agentGrants = sceneGrants.get(agentId);
      return agentGrants ? agentGrants.has(grant) : false;
    },

    deleteScene(sceneId) {
      scenes.delete(sceneId);
      grants.delete(sceneId);
      return true;
    },
  };
}
