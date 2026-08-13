import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface RoomInfoPanelData {
  ok: boolean;
  room: {
    id: string;
    name: string | null;
    type: string;
    description: string | null;
    createdAt: string;
    e2eEnabled: boolean;
    shardCount: number;
  };
  members: Array<{ userId: string; role: string; joinedAt: string }>;
  memberCount: number;
  messageCount: number;
  pins: Array<{ messageId: number; pinnedBy: string; pinnedAt: string }>;
  retention: { mode: string; ttlSeconds: number | null; updatedAt: string } | null;
  live: { online: number; userCount: number; users: string[] } | null;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchRoomInfoPanel(token: string, roomId: string): Promise<RoomInfoPanelData> {
  return fetchWorkerJson(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/info`,
    { headers: authHeaders(token) },
  );
}
