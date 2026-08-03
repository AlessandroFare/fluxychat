import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const BASE = getPublicWorkerUrl();

export interface RoomMlsGroup {
  roomId: string;
  groupId: string;
  epoch: number;
  cipherSuite: string;
  maxDevices: number;
  devices: Array<{ deviceId: string; publicKey: string; signatureKey: string; credentialType?: string }>;
  updatedAt?: string;
}

export async function getRoomMlsGroup(token: string, roomId: string): Promise<{ group: RoomMlsGroup | null }> {
  const res = await fetch(`${BASE}/rooms/${encodeURIComponent(roomId)}/mls-group`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`getRoomMlsGroup failed: ${res.status}`);
  return (await res.json()) as { group: RoomMlsGroup | null };
}

export async function upsertRoomMlsGroup(token: string, roomId: string, input: Partial<RoomMlsGroup>): Promise<{ group: RoomMlsGroup }> {
  const res = await fetch(`${BASE}/rooms/${encodeURIComponent(roomId)}/mls-group`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`upsertRoomMlsGroup failed: ${res.status}`);
  return (await res.json()) as { group: RoomMlsGroup };
}

export async function rotateRoomMlsEpoch(token: string, roomId: string): Promise<{ group: RoomMlsGroup }> {
  const res = await fetch(`${BASE}/rooms/${encodeURIComponent(roomId)}/mls-group/rotate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`rotateRoomMlsEpoch failed: ${res.status}`);
  return (await res.json()) as { group: RoomMlsGroup };
}
