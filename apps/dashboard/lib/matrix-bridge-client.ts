import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface MatrixBridge {
  id: string;
  projectId: string;
  homeserverUrl: string;
  accessToken: string | null;
  botUserId: string | null;
  botDisplayName: string | null;
  syncMode: string;
  status: string;
  settings: Record<string, unknown> | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  appserviceTokenConfigured?: boolean;
  appserviceWebhookPath?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatrixRoomMapping {
  id: string;
  bridgeId: string;
  projectId: string;
  fluxychatRoomId: string;
  matrixRoomId: string;
  matrixSpaceId: string | null;
  syncReactions: boolean;
  syncAttachments: boolean;
  createdAt: string;
}

export interface MatrixBridgeStats {
  totalBridges: number;
  byStatus: Array<{ status: string; count: number }>;
  messages: Array<{ direction: string; count: number }>;
  totalMappings: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function pingMatrixBridgeHealth(token: string, bridgeId: string) {
  return fetchWorkerJson<{ ok: boolean; health: { ok: boolean; error?: string; versions?: string[] } }>(
    `${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}/health`,
    { headers: authHeaders(token) },
  );
}

export async function runMatrixBridgeHealthCheckAll(token: string) {
  return fetchWorkerJson<{ ok: boolean; checked: number; healthy: number; unhealthy: number }>(
    `${BASE}/admin/matrix/bridges/health-check-all`,
    { method: "POST", headers: authHeaders(token) },
  );
}

export async function getMatrixStats(token: string): Promise<{ stats: MatrixBridgeStats }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/stats`, { headers: authHeaders(token) });
}

export async function listMatrixBridges(token: string): Promise<{ bridges: MatrixBridge[] }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges`, { headers: authHeaders(token) });
}

export async function getMatrixBridge(
  token: string,
  bridgeId: string,
): Promise<{ bridge: MatrixBridge; mappings: MatrixRoomMapping[] }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}`, {
    headers: authHeaders(token),
  });
}

export async function createMatrixBridge(
  token: string,
  body: {
    homeserverUrl: string;
    accessToken?: string;
    botUserId?: string;
    botDisplayName?: string;
    syncMode?: string;
  },
): Promise<{ id: string; status: string; appserviceToken?: string; appserviceWebhookPath?: string }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function connectMatrixBridge(token: string, bridgeId: string): Promise<{ connected: number }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}/connect`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function disconnectMatrixBridge(token: string, bridgeId: string): Promise<{ disconnected: number }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}/disconnect`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function rotateMatrixAppserviceToken(
  token: string,
  bridgeId: string,
): Promise<{ appserviceToken: string; bridgeId: string }> {
  return fetchWorkerJson(
    `${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}/rotate-appservice-token`,
    { method: "POST", headers: authHeaders(token) },
  );
}

export async function deleteMatrixBridge(token: string, bridgeId: string): Promise<{ deleted: number }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/bridges/${encodeURIComponent(bridgeId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function createMatrixRoomMapping(
  token: string,
  body: {
    bridgeId: string;
    roomId: string;
    matrixRoomId: string;
    matrixSpaceId?: string;
    syncReactions?: boolean;
    syncAttachments?: boolean;
  },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/mappings`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteMatrixRoomMapping(token: string, mappingId: string): Promise<{ deleted: number }> {
  return fetchWorkerJson(`${BASE}/admin/matrix/mappings/${encodeURIComponent(mappingId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}
