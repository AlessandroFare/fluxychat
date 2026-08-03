import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface CartographyCluster {
  id: number;
  label: string;
  x: number;
  y: number;
  radius: number;
  messageCount: number;
  sampleSnippet: string;
}

export interface CartographyPoint {
  messageId: number;
  clusterId: number;
  x: number;
  y: number;
  createdAt: string;
  preview: string;
  userId: string;
}

export interface RoomCartographyMap {
  id: string;
  projectId: string;
  roomId: string;
  messageCount: number;
  clusterCount: number;
  clusters: CartographyCluster[];
  points: CartographyPoint[];
  builtAt: string;
  expiresAt: string;
}

export async function fetchRoomCartography(token: string, roomId: string, rebuild = false) {
  const qs = rebuild ? "?rebuild=1" : "";
  return fetchWorkerJson<{ ok: boolean; map: RoomCartographyMap; error?: string; count?: number }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/cartography${qs}`,
    { headers: authHeaders(token) },
  );
}

export async function rebuildRoomCartography(token: string, roomId: string) {
  return fetchWorkerJson<{ ok: boolean; map: RoomCartographyMap; error?: string; count?: number }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/cartography`,
    { method: "POST", headers: authHeaders(token) },
  );
}
