import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface FirmwareModuleConfig {
  id: "pii_veto" | "rate_limit" | "denylist";
  enabled: boolean;
  maxPerMinute?: number;
  patterns?: string[];
}

export interface RoomFirmwareSettings {
  id?: string;
  projectId?: string;
  roomId?: string;
  version: number;
  moduleType: "builtin" | "wasm";
  capabilities: string[];
  config: { modules: FirmwareModuleConfig[] };
  wasmR2Key?: string | null;
  enabled: boolean;
  updatedAt: string | null;
}

export interface FirmwareAuditEntry {
  id: string;
  projectId: string;
  roomId: string;
  eventType: string;
  eventId: string | null;
  moduleId: string | null;
  decision: string;
  reason: string | null;
  createdAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getRoomFirmware(
  token: string,
  roomId: string,
): Promise<{ ok: boolean; firmware: RoomFirmwareSettings | null }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/firmware`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateRoomFirmware(
  token: string,
  roomId: string,
  patch: Partial<{
    enabled: boolean;
    moduleType: "builtin" | "wasm";
    config: { modules: FirmwareModuleConfig[] };
  }>,
): Promise<{ ok: boolean; firmware: RoomFirmwareSettings }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/firmware`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
}

export async function listFirmwareAudit(
  token: string,
  roomId: string,
  limit = 50,
): Promise<{ ok: boolean; audit: FirmwareAuditEntry[] }> {
  return fetchWorkerJson(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/firmware/audit?limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
}
