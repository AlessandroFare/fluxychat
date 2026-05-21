import {
  ASSISTANT_ROOM_DISPLAY_NAME,
  ASSISTANT_ROOM_ID,
  type AssistantRoomRef,
} from "@/lib/assistant-room";
import { messageFromUnknown } from "@/lib/error-message";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface EnsureAssistantRoomInput {
  workerUrl: string;
  memberJwt: string;
  memberUserId: string;
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

async function findAssistantRoom(
  workerUrl: string,
  memberJwt: string,
): Promise<AssistantRoomRef | null> {
  const json = await fetchWorkerJson<{ rooms?: AssistantRoomRef[] }>(
    `${workerUrl}/rooms`,
    {
      headers: { Authorization: `Bearer ${memberJwt}` },
    },
  );
  const hit = (json.rooms ?? []).find((r) => r.id === ASSISTANT_ROOM_ID);
  return hit ?? null;
}

/**
 * Idempotently ensure the default assistant room exists for the signed-in member.
 */
export async function ensureAssistantRoom(
  input: EnsureAssistantRoomInput,
): Promise<EnsureAssistantRoomResult> {
  const { workerUrl, memberJwt, memberUserId } = input;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${memberJwt}`,
  };

  try {
    const json = await fetchWorkerJson<{ room: AssistantRoomRef }>(
      `${workerUrl}/rooms`,
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: ASSISTANT_ROOM_ID,
          type: "group",
          name: ASSISTANT_ROOM_DISPLAY_NAME,
          members: [{ userId: memberUserId, role: "member" }],
        }),
      },
    );
    return { room: json.room, created: true };
  } catch (err: unknown) {
    const msg = messageFromUnknown(err, "");
    if (!isRoomExistsError(msg)) throw err;
  }

  const existing = await findAssistantRoom(workerUrl, memberJwt);
  if (existing) {
    return { room: existing, created: false };
  }

  throw new Error(
    `Could not create or find assistant room "${ASSISTANT_ROOM_ID}".`,
  );
}
