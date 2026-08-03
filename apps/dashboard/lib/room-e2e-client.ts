import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface RoomE2eKeyResponse {
  e2eEnabled: boolean;
  roomId: string;
  e2eKey?: string;
  error?: string;
}

export async function getRoomE2eKey(token: string, roomId: string): Promise<RoomE2eKeyResponse> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/e2e-key`, {
    headers: authHeaders(token),
  });
}

export async function updateRoomE2e(
  token: string,
  roomId: string,
  patch: { e2eEnabled?: boolean; rotateE2eKey?: boolean },
): Promise<{ ok: boolean; roomId: string }> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
}
