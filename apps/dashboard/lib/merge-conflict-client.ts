import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface MergeConflictVersion {
  content: string;
  originInstance: string;
  ts: string;
  userId?: string;
  messageId?: number;
  clientMessageId?: string | null;
}

export interface MergeConflictRow {
  id: string;
  roomId: string;
  messageId: number | null;
  clientMessageId: string | null;
  messageKey: string;
  status: string;
  versionA: MergeConflictVersion;
  versionB: MergeConflictVersion;
  resolution: string | null;
  mergedContent: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export async function listMergeConflicts(token: string, roomId: string, status = "open") {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return fetchWorkerJson<{ ok: boolean; conflicts: MergeConflictRow[] }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/merge-conflicts${q}`,
    { headers: authHeaders(token) },
  );
}

export async function reportMergeConflict(
  token: string,
  roomId: string,
  body: {
    messageKey: string;
    messageId?: number;
    clientMessageId?: string;
    parentMessageId?: number;
    versionA: MergeConflictVersion;
    versionB: MergeConflictVersion;
  },
) {
  return fetchWorkerJson<{ ok: boolean; conflictId: string; duplicate?: boolean }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/merge-conflicts`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function resolveMergeConflict(
  token: string,
  conflictId: string,
  resolution: "keep_a" | "keep_b" | "merge_both",
) {
  return fetchWorkerJson<{ ok: boolean; messageId: number | null; content: string }>(
    `${BASE}/merge-conflicts/${encodeURIComponent(conflictId)}/resolve`,
    { method: "POST", headers: authHeaders(token), body: JSON.stringify({ resolution }) },
  );
}
