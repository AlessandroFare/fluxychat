import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface ThreadListItem {
  rootMessageId: number;
  roomId: string;
  rootPreview: string;
  rootUserId: string;
  rootCreatedAt: string;
  replyCount: number;
  lastReply: {
    messageId: number;
    userId: string;
    preview: string;
    createdAt: string;
  };
  unreadCount: number;
  userParticipated: boolean;
}

export interface ListThreadsResponse {
  threads: ThreadListItem[];
  total: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listMyThreads(
  token: string,
  opts?: { limit?: number; unreadOnly?: boolean },
): Promise<ListThreadsResponse> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.unreadOnly) params.set("unread", "1");
  const qs = params.toString();
  return fetchWorkerJson(`${BASE}/threads${qs ? `?${qs}` : ""}`, {
    headers: authHeaders(token),
  });
}

export function threadDeepLink(roomId: string, rootMessageId: number): string {
  return `/rooms?room=${encodeURIComponent(roomId)}&messageId=${rootMessageId}`;
}
