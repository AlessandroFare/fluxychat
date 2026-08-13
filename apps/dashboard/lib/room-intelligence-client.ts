import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

export interface AudienceScore {
  score: number;
  positive: number;
  negative: number;
  total: number;
  windowMinutes: number;
}

export interface RoomMemoryEntry {
  id: string;
  kind: string;
  content: string;
  confidence?: number;
  sourceMessageIds?: number[];
  createdAt?: string;
  updatedAt?: string;
}

export interface MemoryExtractResult {
  roomId: string;
  extracted: number;
  inserted?: number;
  updated?: number;
  entries?: RoomMemoryEntry[];
  message?: string;
  error?: string;
}

export async function fetchAudienceScore(
  roomId: string,
  memberJwt: string,
  windowMinutes = 15,
): Promise<AudienceScore> {
  const base = getPublicWorkerUrl().replace(/\/$/, "");
  return fetchWorkerJson<AudienceScore>(
    `${base}/rooms/${encodeURIComponent(roomId)}/audience-score?windowMinutes=${windowMinutes}`,
    { headers: { Authorization: `Bearer ${memberJwt}` } },
  );
}

export async function fetchRoomMemory(
  roomId: string,
  memberJwt: string,
  limit = 12,
): Promise<{ entries: RoomMemoryEntry[]; count: number }> {
  const base = getPublicWorkerUrl().replace(/\/$/, "");
  return fetchWorkerJson<{ entries: RoomMemoryEntry[]; count: number }>(
    `${base}/rooms/${encodeURIComponent(roomId)}/memory?limit=${limit}`,
    { headers: { Authorization: `Bearer ${memberJwt}` } },
  );
}

export async function extractRoomMemory(
  roomId: string,
  memberJwt: string,
): Promise<MemoryExtractResult> {
  const base = getPublicWorkerUrl().replace(/\/$/, "");
  return fetchWorkerJson<MemoryExtractResult>(
    `${base}/rooms/${encodeURIComponent(roomId)}/memory/extract`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${memberJwt}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    },
  );
}

export function memoryKindLabel(kind: string): string {
  const labels: Record<string, string> = {
    decision: "Decision",
    faq: "FAQ",
    task: "Task",
    user_context: "User context",
    sentiment: "Sentiment",
    key_fact: "Key fact",
  };
  return labels[kind] ?? kind;
}

export function scoreTone(score: number): "positive" | "neutral" | "negative" {
  if (score >= 60) return "positive";
  if (score <= 40) return "negative";
  return "neutral";
}
