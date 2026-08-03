import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface MediaSettings {
  projectId: string;
  maxFileSizeBytes: number;
  maxAttachmentsPerMessage: number;
  allowedMimeTypes: string[];
  avScanEnabled: boolean;
  thumbnailEnabled: boolean;
  updatedAt: string | null;
}

export interface MediaJob {
  id: string;
  projectId: string;
  fileKey: string;
  scanStatus: string;
  scanDetail: string | null;
  thumbnailUrl: string | null;
  thumbnailStatus: string;
  contentType: string | null;
  sizeBytes: number | null;
  scannedAt: string | null;
  createdAt: string;
}

export async function getMediaSettings(token: string) {
  return fetchWorkerJson<{ ok: boolean; settings: MediaSettings }>(
    `${BASE}/admin/media/settings`,
    { headers: authHeaders(token) },
  );
}

export async function updateMediaSettings(token: string, body: Partial<MediaSettings>) {
  return fetchWorkerJson<{ ok: boolean; settings: MediaSettings }>(
    `${BASE}/admin/media/settings`,
    { method: "PUT", headers: authHeaders(token), body: JSON.stringify(body) },
  );
}

export async function listMediaJobs(token: string, limit = 50) {
  return fetchWorkerJson<{ ok: boolean; jobs: MediaJob[] }>(
    `${BASE}/admin/media/jobs?limit=${limit}`,
    { headers: authHeaders(token) },
  );
}
