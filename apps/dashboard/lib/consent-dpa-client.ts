import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface ConsentSettings {
  enabled: boolean;
  autoEuOnly: boolean;
  dpaVersion: string;
  bannerTitle: string;
  bannerBody: string;
  dpaDocumentUrl: string | null;
  requireRoomConsent: boolean;
  updatedAt: string | null;
  configured: boolean;
}

export interface ConsentStatus {
  ok: boolean;
  needsBanner: boolean;
  reason: string;
  settings?: {
    dpaVersion: string;
    bannerTitle: string;
    bannerBody: string;
    dpaDocumentUrl: string | null;
    requireRoomConsent: boolean;
  };
}

export interface ConsentEventRow {
  id: string;
  userId: string;
  roomId: string | null;
  eventType: string;
  dpaVersion: string;
  ipHash: string | null;
  userAgent: string | null;
  createdAt: string;
}

export async function getConsentSettings(token: string) {
  return fetchWorkerJson<{ ok: boolean; settings: ConsentSettings }>(`${BASE}/admin/consent`, {
    headers: authHeaders(token),
  });
}

export async function updateConsentSettings(
  token: string,
  input: Partial<ConsentSettings & { dpaDocumentUrl?: string | null }>,
) {
  return fetchWorkerJson<{ ok: boolean; settings: ConsentSettings }>(`${BASE}/admin/consent`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function listConsentEvents(token: string, params?: { roomId?: string; limit?: number }) {
  const q = new URLSearchParams();
  if (params?.roomId) q.set("roomId", params.roomId);
  if (params?.limit) q.set("limit", String(params.limit));
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return fetchWorkerJson<{ ok: boolean; events: ConsentEventRow[] }>(
    `${BASE}/admin/consent/events${suffix}`,
    { headers: authHeaders(token) },
  );
}

export async function getConsentStatus(token: string, roomId?: string) {
  const q = roomId ? `?roomId=${encodeURIComponent(roomId)}` : "";
  return fetchWorkerJson<ConsentStatus>(`${BASE}/consent/status${q}`, {
    headers: authHeaders(token),
  });
}

export async function acknowledgeConsent(
  token: string,
  body: { roomId?: string; eventType: "accepted" | "declined" | "withdrawn"; dpaVersion?: string },
) {
  return fetchWorkerJson<{ ok: boolean; event: { id: string; eventType: string; createdAt: string } }>(
    `${BASE}/consent/acknowledge`,
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify(body),
    },
  );
}
