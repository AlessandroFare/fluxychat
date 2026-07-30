import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export type CrmProvider = "salesforce" | "zendesk" | "hubspot" | "intercom";

export interface CrmConnection {
  provider: CrmProvider;
  instanceUrl: string | null;
  enabled: boolean;
  apiKey: string | null;
  lastSyncAt: string | null;
  updatedAt: string;
}

export interface CrmSyncResult {
  provider: CrmProvider;
  direction: string;
  contactsSynced: number;
  ticketsSynced: number;
  errors: string[];
  syncedAt: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listCrmConnections(token: string): Promise<{ connections: CrmConnection[] }> {
  return fetchWorkerJson(`${BASE}/admin/crm/connections`, { headers: authHeaders(token) });
}

export async function upsertCrmConnection(
  token: string,
  body: { provider: CrmProvider; apiKey?: string; instanceUrl?: string; webhookSecret?: string; enabled?: boolean },
): Promise<{ connection: CrmConnection }> {
  return fetchWorkerJson(`${BASE}/admin/crm/connections`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function syncCrmConnection(
  token: string,
  provider: CrmProvider,
  direction: "in" | "out" | "bidirectional" = "bidirectional",
): Promise<CrmSyncResult> {
  return fetchWorkerJson(`${BASE}/admin/crm/sync`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify({ provider, direction }),
  });
}

export async function listCrmSyncHistory(token: string): Promise<{ history: CrmSyncResult[]; count: number }> {
  return fetchWorkerJson(`${BASE}/admin/crm/sync/history`, { headers: authHeaders(token) });
}

export async function lookupCrmContact(
  token: string,
  provider: CrmProvider,
  email: string,
): Promise<{ contact: Record<string, unknown> | null }> {
  const url = new URL(`${BASE}/admin/crm/contacts/lookup`);
  url.searchParams.set("provider", provider);
  url.searchParams.set("email", email);
  return fetchWorkerJson(url.toString(), { headers: authHeaders(token) });
}

export async function createCrmTicket(
  token: string,
  body: { provider: CrmProvider; subject: string; description?: string; contactEmail?: string; priority?: string },
): Promise<{ ticket: Record<string, unknown> }> {
  return fetchWorkerJson(`${BASE}/admin/crm/tickets`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function handoffCrmToAgent(
  token: string,
  body: { provider: CrmProvider; ticketId: string; roomId: string; agentId: string },
): Promise<{ handoff: Record<string, unknown> }> {
  return fetchWorkerJson(`${BASE}/admin/crm/handoff`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
