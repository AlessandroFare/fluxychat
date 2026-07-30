import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface CustomerProfile {
  id: string;
  projectId: string;
  externalId: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  lifecycleStage: string;
  score: number | null;
  tags: string[];
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface CustomerSegment {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  segmentType: string;
  status: string;
  customerCount: number;
  createdAt: string;
}

export interface CustomerStats {
  totalCustomers: number;
  byLifecycle: Array<{ stage: string; count: number }>;
  recentEvents: number;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function getCustomerStats(token: string): Promise<CustomerStats> {
  return fetchWorkerJson(`${BASE}/api/cdp/stats`, { headers: authHeaders(token) });
}

export async function listCustomers(
  token: string,
  opts?: { search?: string; lifecycleStage?: string; limit?: number },
): Promise<CustomerProfile[]> {
  const url = new URL(`${BASE}/api/cdp/customers`);
  if (opts?.search) url.searchParams.set("search", opts.search);
  if (opts?.lifecycleStage) url.searchParams.set("lifecycleStage", opts.lifecycleStage);
  if (opts?.limit) url.searchParams.set("limit", String(opts.limit));
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function upsertCustomer(
  token: string,
  body: { externalId: string; email?: string; name?: string; phone?: string; lifecycleStage?: string },
): Promise<{ id: string; created?: boolean; updated?: boolean }> {
  return fetchWorkerJson(`${BASE}/api/cdp/customers`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listCdpSegments(token: string): Promise<CustomerSegment[]> {
  return fetchWorkerJson(`${BASE}/api/cdp/segments`, { headers: authHeaders(token) });
}

export async function createCdpSegment(
  token: string,
  body: { name: string; description?: string; segmentType?: string },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/cdp/segments`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function addSegmentMember(
  token: string,
  segmentId: string,
  customerId: string,
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/cdp/segments/${encodeURIComponent(segmentId)}/members`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ customerId }),
  });
}

export async function createCdpBroadcast(
  token: string,
  body: { name: string; segmentId?: string; channel?: string; content: string },
): Promise<{ id: string }> {
  return fetchWorkerJson(`${BASE}/api/cdp/broadcasts`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function listCdpBroadcasts(token: string): Promise<Array<Record<string, unknown>>> {
  return fetchWorkerJson(`${BASE}/api/cdp/broadcasts`, { headers: authHeaders(token) });
}
