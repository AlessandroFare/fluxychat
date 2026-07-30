import type { FluxyChatClient } from "./index";
import type { GrantType, SpatialEntity, SpatialSceneState } from "./digital-twin";

export interface WorkerDigitalTwinClient {
  createScene(input: { name: string; roomId?: string; metadata?: Record<string, unknown> }): Promise<SpatialSceneState>;
  listScenes(filter?: { roomId?: string }): Promise<SpatialSceneState[]>;
  getScene(sceneId: string): Promise<SpatialSceneState | null>;
  addEntity(sceneId: string, entity: Omit<SpatialEntity, "id">): Promise<SpatialEntity>;
  grantAgent(sceneId: string, grant: { agentId: string; grants: GrantType[]; entityFilter?: string[] }): Promise<void>;
  deleteScene(sceneId: string): Promise<void>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

export function createWorkerDigitalTwinClient(client: FluxyChatClient): WorkerDigitalTwinClient {
  return {
    async createScene(input) {
      const res = await fetch(`${base(client)}/spatial/scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createScene failed: ${res.status}`);
      const body = (await res.json()) as { scene: SpatialSceneState };
      return body.scene;
    },
    async listScenes(filter) {
      const url = new URL(`${base(client)}/spatial/scenes`);
      if (filter?.roomId) url.searchParams.set("roomId", filter.roomId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listScenes failed: ${res.status}`);
      const body = (await res.json()) as { scenes: SpatialSceneState[] };
      return body.scenes;
    },
    async getScene(sceneId) {
      const res = await fetch(`${base(client)}/spatial/scenes/${encodeURIComponent(sceneId)}`, {
        headers: await headers(client),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`getScene failed: ${res.status}`);
      const body = (await res.json()) as { scene: SpatialSceneState };
      return body.scene;
    },
    async addEntity(sceneId, entity) {
      const res = await fetch(`${base(client)}/spatial/scenes/${encodeURIComponent(sceneId)}/entities`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(entity),
      });
      if (!res.ok) throw new Error(`addEntity failed: ${res.status}`);
      const body = (await res.json()) as { entity: SpatialEntity };
      return body.entity;
    },
    async grantAgent(sceneId, grant) {
      const res = await fetch(`${base(client)}/spatial/scenes/${encodeURIComponent(sceneId)}/grants`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(grant),
      });
      if (!res.ok) throw new Error(`grantAgent failed: ${res.status}`);
    },
    async deleteScene(sceneId) {
      const res = await fetch(`${base(client)}/spatial/scenes/${encodeURIComponent(sceneId)}`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`deleteScene failed: ${res.status}`);
    },
  };
}
