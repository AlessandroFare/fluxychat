import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface TenantUsageSnapshot {
  projectId: string;
  monthKey: string;
  plan: {
    planName: string;
    billingStatus: string;
    messageLimitMonthly: number | null;
    agentInvokeLimitMonthly: number | null;
    webhookDeliveryLimitMonthly: number | null;
  } | null;
  monthlyUsage: {
    messagesCreated: number;
    agentInvokes: number;
    webhookDeliveries: number;
  };
  totals: {
    messagesAllTime: number;
    rooms: number;
    mau: number;
    attachmentFiles: number;
    storageBytes: number;
    storageGb: number;
  };
  opsLast30d: Record<string, number>;
  costEstimate: {
    currency: string;
    monthKey: string;
    estimatedUsd: number;
    rates: {
      perThousandMessagesUsd: number;
      perAgentInvokeUsd: number;
      perGbStorageMonthUsd: number;
      platformBaseUsd: number;
    };
    disclaimer: string;
  };
  updatedAt: string;
}

export async function getTenantUsage(token: string): Promise<{ ok: boolean; usage: TenantUsageSnapshot }> {
  return fetchWorkerJson(`${BASE}/admin/tenant-usage`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
