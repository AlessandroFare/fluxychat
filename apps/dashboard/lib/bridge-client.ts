import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface BridgeConfig {
  id: string;
  projectId: string;
  platform: string;
  name: string;
  token: string | null;
  webhookUrl: string | null;
  botUserId: string | null;
  botDisplayName: string | null;
  status: string;
  settings: Record<string, unknown> | null;
  lastSyncAt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChannelMapping {
  id: string;
  bridgeId: string;
  projectId: string;
  fluxychatRoomId: string;
  externalChannelId: string;
  externalChannelName: string | null;
  syncDirection: string;
  syncReactions: boolean;
  syncAttachments: boolean;
  autoReply: boolean;
  createdAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export function bridgeInboundWebhookUrl(platform: "slack" | "discord", bridgeId: string): string {
  return `${BASE}/webhooks/bridge/${platform}/${encodeURIComponent(bridgeId)}`;
}

export async function listBridges(
  token: string,
  platform?: string,
): Promise<{ bridges: BridgeConfig[] }> {
  const url = new URL(`${BASE}/admin/bridges`);
  if (platform) url.searchParams.set("platform", platform);
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function getBridge(
  token: string,
  bridgeId: string,
): Promise<{ bridge: BridgeConfig; mappings: ChannelMapping[] }> {
  return fetchWorkerJson(`${BASE}/admin/bridges/${encodeURIComponent(bridgeId)}`, {
    headers: authHeaders(token),
  });
}

export async function createBridge(
  token: string,
  body: {
    platform: string;
    name: string;
    token?: string;
    webhookUrl?: string;
    botUserId?: string;
    botDisplayName?: string;
  },
): Promise<{ id: string; status: string }> {
  return fetchWorkerJson(`${BASE}/admin/bridges`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function connectBridge(token: string, bridgeId: string): Promise<{ connected: number }> {
  return fetchWorkerJson(`${BASE}/admin/bridges/${encodeURIComponent(bridgeId)}/connect`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function disconnectBridge(token: string, bridgeId: string): Promise<{ disconnected: number }> {
  return fetchWorkerJson(`${BASE}/admin/bridges/${encodeURIComponent(bridgeId)}/disconnect`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function deleteBridge(token: string, bridgeId: string): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/bridges/${encodeURIComponent(bridgeId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function createChannelMapping(
  token: string,
  body: {
    bridgeId: string;
    roomId: string;
    externalChannelId: string;
    externalChannelName?: string;
    syncDirection?: string;
  },
): Promise<ChannelMapping> {
  return fetchWorkerJson(`${BASE}/admin/bridges/mappings`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteChannelMapping(token: string, mappingId: string): Promise<unknown> {
  return fetchWorkerJson(`${BASE}/admin/bridges/mappings/${encodeURIComponent(mappingId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function getBridgeStats(token: string): Promise<{ stats: Record<string, unknown> }> {
  return fetchWorkerJson(`${BASE}/admin/bridges/stats`, { headers: authHeaders(token) });
}
