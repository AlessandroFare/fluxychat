import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface SemanticSearchSettings {
  globalEnabled: boolean;
  enabled: boolean;
  autoEmbed: boolean;
  defaultMode: "keyword" | "hybrid" | "semantic";
  embeddingCount: number;
  updatedAt: string | null;
  available: boolean;
}

export interface SemanticSearchResult {
  id: number;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  snippet: string;
  score?: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function getSemanticSearchSettings(token: string): Promise<{ settings: SemanticSearchSettings }> {
  return fetchWorkerJson(`${BASE}/search/settings`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function updateSemanticSearchSettings(
  token: string,
  input: { enabled?: boolean; autoEmbed?: boolean; defaultMode?: SemanticSearchSettings["defaultMode"] },
): Promise<{ settings: SemanticSearchSettings }> {
  return fetchWorkerJson(`${BASE}/admin/search/settings`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function backfillMessageEmbeddings(
  token: string,
  options?: { roomId?: string; limit?: number },
): Promise<{ ok: boolean; processed: number; stored: number; skipped: number; embeddingCount: number }> {
  return fetchWorkerJson(`${BASE}/search/messages/backfill`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(options ?? {}),
  });
}

export async function searchMessagesSemantic(
  token: string,
  query: string,
  options?: {
    roomId?: string;
    limit?: number;
    mode?: "hybrid" | "semantic";
  },
): Promise<{ query: string; mode: string; results: SemanticSearchResult[] }> {
  return fetchWorkerJson(`${BASE}/search/messages/semantic`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      query,
      roomId: options?.roomId,
      limit: options?.limit,
      mode: options?.mode ?? "hybrid",
    }),
  });
}
