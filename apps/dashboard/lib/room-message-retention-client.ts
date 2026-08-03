import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface RoomMessageRetentionSettings {
  mode: "standard" | "ephemeral" | "custom";
  ttlSeconds: number | null;
  updatedAt: string | null;
}

export interface RoomRetentionListItem {
  roomId: string;
  mode: string;
  ttlSeconds: number | null;
  updatedAt: string | null;
}

async function authFetch(token: string, path: string, init?: RequestInit) {
  return fetchWorkerJson(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
}

export async function getRoomMessageRetention(token: string, roomId: string) {
  const data = await authFetch(
    token,
    `/rooms/${encodeURIComponent(roomId)}/message-retention`,
  );
  return data as { ok: boolean; roomId: string; settings: RoomMessageRetentionSettings };
}

export async function updateRoomMessageRetention(
  token: string,
  roomId: string,
  patch: { mode?: RoomMessageRetentionSettings["mode"]; ttlSeconds?: number | null },
) {
  const data = await authFetch(
    token,
    `/rooms/${encodeURIComponent(roomId)}/message-retention`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data as { ok: boolean; roomId: string; settings: RoomMessageRetentionSettings };
}

export async function listRoomMessageRetention(token: string) {
  const data = await authFetch(token, "/admin/room-message-retention");
  return data as { ok: boolean; rooms: RoomRetentionListItem[] };
}

export async function purgeRoomMessageRetention(token: string, roomId: string) {
  const data = await authFetch(
    token,
    `/admin/rooms/${encodeURIComponent(roomId)}/message-retention/purge`,
    { method: "POST", body: "{}" },
  );
  return data as { ok: boolean; purged: number; roomId: string };
}
