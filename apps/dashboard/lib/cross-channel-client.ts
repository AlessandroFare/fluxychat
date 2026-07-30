import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface IdentityBinding {
  id: string;
  customerId: string;
  channel: string;
  channelUserId: string;
  linkedAt: string;
}

export interface JourneyStep {
  type: string;
  channel?: string;
  channelUserId?: string;
  metadata?: Record<string, unknown> | null;
  timestamp: string;
  mergedFrom?: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listIdentityBindings(
  token: string,
  customerId?: string,
): Promise<{ bindings: IdentityBinding[]; count: number }> {
  const url = new URL(`${BASE}/admin/cross-channel/bindings`);
  if (customerId) url.searchParams.set("customerId", customerId);
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function bindChannelIdentity(
  token: string,
  body: { customerId: string; channel: string; channelUserId: string },
): Promise<{ binding: IdentityBinding }> {
  return fetchWorkerJson(`${BASE}/admin/cross-channel/bindings`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function mergeCustomerProfiles(
  token: string,
  primaryCustomerId: string,
  secondaryCustomerId: string,
): Promise<{ merged: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/cross-channel/merge`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ primaryCustomerId, secondaryCustomerId }),
  });
}

export async function recordJourneyStep(
  token: string,
  body: { customerId: string; channel: string; step?: string; metadata?: Record<string, unknown> },
): Promise<{ recorded: boolean; entry: JourneyStep }> {
  return fetchWorkerJson(`${BASE}/admin/cross-channel/journey`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listJourneyHistory(
  token: string,
  customerId: string,
  limit = 30,
): Promise<{ journey: JourneyStep[]; count: number }> {
  const url = new URL(`${BASE}/admin/cross-channel/journey`);
  url.searchParams.set("customerId", customerId);
  url.searchParams.set("limit", String(limit));
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function getUnifiedCustomerView(
  token: string,
  customerId: string,
): Promise<{ customer: Record<string, unknown>; bindings: IdentityBinding[]; journey: JourneyStep[]; channels: string[] }> {
  return fetchWorkerJson(`${BASE}/admin/cross-channel/customers/${encodeURIComponent(customerId)}`, {
    headers: authHeaders(token),
  });
}
