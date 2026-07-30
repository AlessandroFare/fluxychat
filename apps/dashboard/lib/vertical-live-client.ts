import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface LivePollResult {
  ok: boolean;
  poll?: { id: string; title: string };
  error?: string;
}

export interface LiveBreakoutResult {
  ok: boolean;
  breakout?: { id: string; name: string };
  error?: string;
}

export interface LiveHybridResult {
  id: string;
  name: string;
  qrCode?: string;
}

export interface LiveStreamEventResult {
  event?: {
    id: string;
    title: string;
    status: string;
    whipUrl?: string | null;
    playbackHls?: string | null;
    liveInputUid?: string | null;
  };
  error?: string;
}

export async function createRoomPoll(
  token: string,
  input: { roomId: string; title: string; options: string[] },
): Promise<LivePollResult> {
  return fetchWorkerJson(`${BASE}/polls`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      roomId: input.roomId,
      title: input.title,
      pollType: "single",
      options: input.options,
    }),
  });
}

export async function createRoomBreakout(
  token: string,
  roomId: string,
  name: string,
): Promise<LiveBreakoutResult> {
  return fetchWorkerJson(`${BASE}/rooms/${encodeURIComponent(roomId)}/breakouts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
}

export async function createHybridEvent(
  token: string,
  input: { roomId: string; name: string; mode?: string },
): Promise<LiveHybridResult> {
  return fetchWorkerJson(`${BASE}/hybrid/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}

export async function checkInHybridEvent(
  token: string,
  hybridEventId: string,
  checkinType: "physical" | "remote" = "remote",
): Promise<{ id: string; checkinType: string }> {
  return fetchWorkerJson(`${BASE}/hybrid/events/${encodeURIComponent(hybridEventId)}/checkin`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ checkinType }),
  });
}

export async function createLiveStageEvent(
  adminToken: string,
  input: { roomId: string; title: string },
): Promise<LiveStreamEventResult> {
  const created = await fetchWorkerJson<{ event: LiveStreamEventResult["event"] }>(`${BASE}/api/live/events`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ roomId: input.roomId, title: input.title }),
  });
  return { event: created.event };
}

export async function goLiveStageEvent(
  adminToken: string,
  eventId: string,
): Promise<LiveStreamEventResult> {
  const updated = await fetchWorkerJson<LiveStreamEventResult["event"]>(
    `${BASE}/api/live/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ status: "live" }),
    },
  );
  return { event: updated };
}
