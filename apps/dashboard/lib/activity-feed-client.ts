import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface ActivityFeedItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  roomId: string | null;
  messageId: number | null;
  actorUserId: string | null;
  readAt: string | null;
  createdAt: string;
  unread: boolean;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listUserActivityFeed(
  token: string,
  options?: { limit?: number; unreadOnly?: boolean },
): Promise<{ items: ActivityFeedItem[]; unreadCount: number }> {
  const params = new URLSearchParams();
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.unreadOnly) params.set("unreadOnly", "true");
  const qs = params.toString();
  return fetchWorkerJson(`${BASE}/user/activity-feed${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function markActivityFeedRead(
  token: string,
  ids?: string[],
): Promise<{ ok: boolean; marked: number | "all" }> {
  return fetchWorkerJson(`${BASE}/user/activity-feed/read`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(ids?.length ? { ids } : {}),
  });
}
