import {
  assistantRoomId,
  ASSISTANT_ROOM_DISPLAY_NAME,
  LEGACY_ASSISTANT_ROOM_ID,
  type AssistantRoomRef,
} from "@/lib/assistant-room";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface EnsureAssistantRoomInput {
  workerUrl: string;
  memberJwt: string;
  memberUserId: string;
  projectId: string;
  /** When set, can add the member to an existing group room. */
  adminJwt?: string;
}

export interface EnsureAssistantRoomResult {
  room: AssistantRoomRef;
  created: boolean;
}

function isRoomExistsError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("room_id_already_exists") ||
    lower.includes("unique constraint") ||
    lower.includes("already exists")
  );
}

async function listProjectRooms(
  workerUrl: string,
  memberJwt: string,
): Promise<AssistantRoomRef[]> {
  const json = await fetchWorkerJson<{ rooms?: AssistantRoomRef[] }>(
    `${workerUrl}/rooms`,
    {
      headers: { Authorization: `Bearer ${memberJwt}` },
    },
  );
  return json.rooms ?? [];
}

async function ensureRoomMembership(
  workerUrl: string,
  adminJwt: string,
  roomId: string,
  userId: string,
): Promise<void> {
  try {
    await fetchWorkerJson(`${workerUrl}/rooms/${encodeURIComponent(roomId)}/members`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminJwt}`,
      },
      body: JSON.stringify({ userId, role: "member" }),
    });
  } catch {
    /* already a member or admin token unavailable */
  }
}

/**
 * Idempotently ensure the default assistant room exists for the signed-in member.
 */
export async function ensureAssistantRoom(
  input: EnsureAssistantRoomInput,
): Promise<EnsureAssistantRoomResult> {
  const { workerUrl, memberJwt, memberUserId, projectId, adminJwt } = input;
  const roomId = assistantRoomId(projectId);
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${memberJwt}`,
  };

  const existingBefore = pickAssistantRoom(roomId, await listProjectRooms(workerUrl, memberJwt));
  if (existingBefore) {
    const adminToken = adminJwt?.trim();
    if (adminToken) {
      await ensureRoomMembership(workerUrl, adminToken, existingBefore.id, memberUserId);
    }
    return { room: existingBefore, created: false };
  }

  try {
    const json = await fetchWorkerJson<{ room: AssistantRoomRef }>(
      `${workerUrl}/rooms`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: roomId,
          type: "group",
          name: ASSISTANT_ROOM_DISPLAY_NAME,
          members: [{ userId: memberUserId, role: "member" }],
        }),
      },
    );
    const room = json.room?.id ? json.room : { ...json.room, id: roomId };
    return { room, created: true };
  } catch (err: unknown) {
    const msg = messageFromUnknown(err, "");
    if (!isRoomExistsError(msg)) throw err;
  }

  const existing = pickAssistantRoom(roomId, await listProjectRooms(workerUrl, memberJwt));
  if (existing) {
    const adminToken = adminJwt?.trim();
    if (adminToken) {
      await ensureRoomMembership(workerUrl, adminToken, existing.id, memberUserId);
    }
    return { room: existing, created: false };
  }

  throw new Error(
    `Could not create or find assistant room "${roomId}".`,
  );
}

function pickAssistantRoom(roomId: string, rooms: AssistantRoomRef[]): AssistantRoomRef | null {
  return (
    rooms.find((r) => r.id === roomId) ??
    rooms.find((r) => r.id === LEGACY_ASSISTANT_ROOM_ID) ??
    rooms.find((r) => r.name === ASSISTANT_ROOM_DISPLAY_NAME) ??
    rooms.find((r) => r.name === LEGACY_ASSISTANT_ROOM_ID) ??
    null
  );
}
