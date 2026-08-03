import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface RoomTranslationSettings {
  enabled: boolean;
  autoTranslateTarget: string | null;
  updatedAt: string | null;
}

export interface RoomTranslationListItem {
  roomId: string;
  enabled: boolean;
  autoTranslateTarget: string | null;
  updatedAt: string | null;
}

async function authFetch(token: string, path: string, init?: RequestInit) {
  return fetchWorkerJson(`${BASE}${path}`, {
    ...init,
    headers: { ...authHeaders(token), ...(init?.headers ?? {}) },
  });
}

export async function getRoomTranslationSettings(token: string, roomId: string) {
  const data = await authFetch(
    token,
    `/rooms/${encodeURIComponent(roomId)}/translation-settings`,
  );
  return data as { ok: boolean; roomId: string; settings: RoomTranslationSettings };
}

export async function updateRoomTranslationSettings(
  token: string,
  roomId: string,
  patch: { enabled?: boolean; autoTranslateTarget?: string | null },
) {
  const data = await authFetch(
    token,
    `/rooms/${encodeURIComponent(roomId)}/translation-settings`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data as { ok: boolean; roomId: string; settings: RoomTranslationSettings };
}

export async function listRoomTranslationSettings(token: string) {
  const data = await authFetch(token, "/admin/room-translation-settings");
  return data as { ok: boolean; rooms: RoomTranslationListItem[] };
}
