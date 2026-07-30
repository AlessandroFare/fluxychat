import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export type KbSourceType =
  | "url"
  | "notion"
  | "confluence"
  | "google_drive"
  | "intercom"
  | "zendesk"
  | "file";

export interface KbSource {
  id: string;
  type: KbSourceType;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  createdAt: string;
  lastSyncedAt: string | null;
}

export interface KbSearchHit {
  id: string;
  title: string;
  excerpt: string;
  category: string | null;
  tags: Record<string, unknown> | null;
  updatedAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listKbSources(token: string): Promise<{ sources: KbSource[] }> {
  return fetchWorkerJson(`${BASE}/admin/kb/sources`, { headers: authHeaders(token) });
}

export async function createKbSource(
  token: string,
  body: { type: KbSourceType; name: string; config?: Record<string, string> },
): Promise<{ source: KbSource }> {
  return fetchWorkerJson(`${BASE}/admin/kb/sources`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteKbSource(token: string, sourceId: string): Promise<void> {
  await fetchWorkerJson(`${BASE}/admin/kb/sources/${encodeURIComponent(sourceId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function syncKbSource(
  token: string,
  sourceId: string,
  body?: { url?: string; title?: string; content?: string },
): Promise<{ articleId?: string }> {
  return fetchWorkerJson(`${BASE}/admin/kb/sources/${encodeURIComponent(sourceId)}/sync`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}

export async function searchKb(
  token: string,
  query: string,
  sourceId?: string,
): Promise<{ hits: KbSearchHit[]; count: number }> {
  const url = new URL(`${BASE}/admin/kb/search`);
  url.searchParams.set("q", query);
  if (sourceId) url.searchParams.set("sourceId", sourceId);
  return fetchWorkerJson(url.href, { headers: authHeaders(token) });
}

export async function buildKbRagContext(
  token: string,
  query: string,
): Promise<{ hits: KbSearchHit[]; synthesizedPrompt: string }> {
  return fetchWorkerJson(`${BASE}/admin/kb/rag`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ query, maxResults: 5 }),
  });
}
