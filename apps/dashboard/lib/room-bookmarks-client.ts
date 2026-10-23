import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface RoomBookmarkItem {
  id: string;
  label: string;
  url: string;
  position: number;
  createdBy?: string | null;
  createdAt?: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

function jsonHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listRoomBookmarks(
  token: string,
  roomId: string,
): Promise<RoomBookmarkItem[]> {
  const data = await fetchWorkerJson<{ bookmarks?: RoomBookmarkItem[] }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/bookmarks`,
    { headers: authHeaders(token) },
  );
  return Array.isArray(data.bookmarks) ? data.bookmarks : [];
}

export async function createRoomBookmark(
  token: string,
  roomId: string,
  input: { label: string; url: string },
): Promise<RoomBookmarkItem | null> {
  const data = await fetchWorkerJson<{ bookmark?: RoomBookmarkItem }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/bookmarks`,
    {
      method: "POST",
      headers: jsonHeaders(token),
      body: JSON.stringify(input),
    },
  );
  return data.bookmark ?? null;
}

export async function deleteRoomBookmark(
  token: string,
  roomId: string,
  bookmarkId: string,
): Promise<void> {
  await fetchWorkerJson(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/bookmarks/${encodeURIComponent(bookmarkId)}`,
    { method: "DELETE", headers: authHeaders(token) },
  );
}
