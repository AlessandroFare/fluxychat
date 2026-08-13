import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface PushConfigSummary {
  id: string;
  environment: string;
  hasFcm: boolean;
  hasApns: boolean;
  apnsBundleId: string | null;
  apnsUseSandbox: boolean;
  webPushEnabled: boolean;
  updatedAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listPushConfigs(token: string): Promise<{ configs: PushConfigSummary[] }> {
  return fetchWorkerJson(`${BASE}/push/config`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function upsertPushConfig(
  token: string,
  input: {
    environment?: string;
    fcmServerKey?: string;
    fcmProjectId?: string;
    fcmServiceAccountJson?: string;
    apnsKeyId?: string;
    apnsTeamId?: string;
    apnsBundleId?: string;
    apnsPrivateKeyPem?: string;
    apnsUseSandbox?: boolean;
    webPushEnabled?: boolean;
  },
): Promise<{ ok: boolean; id: string; environment: string }> {
  return fetchWorkerJson(`${BASE}/push/config`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function listCannedResponses(
  token: string,
  category?: string,
): Promise<{ responses: Array<{ id: string; shortcut: string; title: string; body: string; category: string | null; usageCount: number }> }> {
  const qs = category ? `?category=${encodeURIComponent(category)}` : "";
  return fetchWorkerJson(`${BASE}/support/canned-responses${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getBusinessHours(token: string): Promise<{
  enabled: boolean;
  timezone: string;
  schedule: Record<string, { open?: string; close?: string; enabled?: boolean }>;
  offlineMessage: string;
  isWithinHours: boolean;
}> {
  return fetchWorkerJson(`${BASE}/support/business-hours`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function upsertBusinessHours(
  token: string,
  input: {
    enabled?: boolean;
    timezone?: string;
    schedule?: Record<string, { open?: string; close?: string; enabled?: boolean }>;
    offlineMessage?: string;
  },
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/support/business-hours`, {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function createCannedResponse(
  token: string,
  input: { shortcut: string; title: string; body: string; category?: string },
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return fetchWorkerJson(`${BASE}/support/canned-responses`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function updateCannedResponse(
  token: string,
  id: string,
  input: { title?: string; body?: string; category?: string },
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/support/canned-responses/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function deleteCannedResponse(
  token: string,
  id: string,
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/support/canned-responses/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export interface SupportStats {
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  avgSatisfaction: number;
  avgFirstResponseHours: number;
  openTickets: number;
  kbArticles: { total: number; published: number };
}

export async function getSupportStats(token: string): Promise<SupportStats> {
  return fetchWorkerJson(`${BASE}/api/support/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getPendingCsat(
  token: string,
  roomId: string,
): Promise<{ survey: { id: string; ticketId: string; surveyType: string; createdAt: string } | null }> {
  return fetchWorkerJson(`${BASE}/support/csat/pending?roomId=${encodeURIComponent(roomId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function respondToCsat(
  token: string,
  surveyId: string,
  input: { rating: number; feedback?: string },
): Promise<{ ok: boolean; error?: string }> {
  return fetchWorkerJson(`${BASE}/support/csat/${encodeURIComponent(surveyId)}/respond`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}
