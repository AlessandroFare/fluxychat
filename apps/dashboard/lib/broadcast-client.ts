import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface BroadcastSegment {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  segmentType: string;
  rules: unknown[];
  createdAt: string;
}

export interface BroadcastCampaign {
  id: string;
  projectId: string;
  segmentId: string | null;
  name: string;
  messageTemplate: string;
  channel: string;
  status: string;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listBroadcastSegments(token: string): Promise<{ segments: BroadcastSegment[]; count: number }> {
  return fetchWorkerJson(`${BASE}/broadcast/segments`, { headers: authHeaders(token) });
}

export async function createBroadcastSegment(
  token: string,
  body: { name: string; description?: string; segmentType?: string },
): Promise<BroadcastSegment> {
  return fetchWorkerJson(`${BASE}/broadcast/segments`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listBroadcastCampaigns(token: string): Promise<{ campaigns: BroadcastCampaign[]; count: number }> {
  return fetchWorkerJson(`${BASE}/broadcast/campaigns`, { headers: authHeaders(token) });
}

export async function createBroadcastCampaign(
  token: string,
  body: { name: string; messageTemplate: string; segmentId?: string; channel?: string },
): Promise<BroadcastCampaign> {
  return fetchWorkerJson(`${BASE}/broadcast/campaigns`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function sendBroadcastCampaign(token: string, campaignId: string): Promise<BroadcastCampaign> {
  return fetchWorkerJson(`${BASE}/broadcast/campaigns/${encodeURIComponent(campaignId)}/send`, {
    method: "POST",
    headers: authHeaders(token),
  });
}

export async function getBroadcastCampaignStats(
  token: string,
  campaignId: string,
): Promise<Record<string, unknown>> {
  return fetchWorkerJson(`${BASE}/broadcast/stats/${encodeURIComponent(campaignId)}`, {
    headers: authHeaders(token),
  });
}
