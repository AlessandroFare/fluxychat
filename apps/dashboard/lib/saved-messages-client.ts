import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface SavedMessageItem {
  messageId: number;
  roomId: string;
  roomName: string;
  authorId: string;
  preview: string;
  createdAt: string;
  savedAt: string;
}

export async function listSavedMessages(
  token: string,
  limit = 50,
): Promise<SavedMessageItem[]> {
  const data = await fetchWorkerJson<{ items?: SavedMessageItem[] }>(
    `${BASE}/saved-messages?limit=${limit}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return Array.isArray(data.items) ? data.items : [];
}
