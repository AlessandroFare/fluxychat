import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export interface ChannelFormField {
  id: string;
  label: string;
  type: "select" | "yes_no" | "rating" | "text";
  options?: Array<{ value: string; label: string }>;
}

export interface ChannelFormDelivery {
  id: string;
  roomId: string;
  formId: string | null;
  channel: "whatsapp" | "rcs";
  recipientE164: string;
  status: string;
  schema: { title?: string; fields: ChannelFormField[] };
  responses: Record<string, string>;
  currentFieldIndex: number;
  createdAt: string;
  respondedAt: string | null;
}

export async function dispatchChannelForm(
  token: string,
  body: {
    roomId: string;
    channel: "whatsapp" | "rcs";
    recipientE164: string;
    formId?: string;
    schema?: { title?: string; description?: string; fields: ChannelFormField[] };
    channelConfigId?: string;
  },
) {
  return fetchWorkerJson<{
    ok: boolean;
    deliveryId: string;
    channel: string;
    dryRun?: boolean;
    providerPayload?: unknown;
    fieldCount: number;
    error?: string;
  }>(`${BASE}/admin/channel-forms/dispatch`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

export async function listChannelFormDeliveries(token: string, roomId?: string) {
  const q = roomId ? `?roomId=${encodeURIComponent(roomId)}` : "";
  return fetchWorkerJson<{ ok: boolean; deliveries: ChannelFormDelivery[] }>(
    `${BASE}/admin/channel-forms/deliveries${q}`,
    { headers: authHeaders(token) },
  );
}

export function whatsAppFormWebhookUrl(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return `${BASE}/webhooks/channel-forms/whatsapp${q}`;
}

export function rcsFormWebhookUrl(projectId?: string) {
  const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return `${BASE}/webhooks/channel-forms/rcs${q}`;
}
