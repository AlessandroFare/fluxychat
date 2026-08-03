import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export interface DataResidencySettings {
  primaryRegion: string;
  allowedRegions: string[];
  inferenceRegion: string;
  enforceWrites: boolean;
  updatedAt: string | null;
  configured: boolean;
}

export async function getDataResidencySettings(token: string) {
  return fetchWorkerJson<{
    ok: boolean;
    settings: DataResidencySettings;
    workerRegion: string;
    validRegions: string[];
  }>(`${BASE}/admin/data-residency`, { headers: authHeaders(token) });
}

export async function updateDataResidencySettings(
  token: string,
  input: Partial<DataResidencySettings>,
) {
  return fetchWorkerJson<{ ok: boolean; settings: DataResidencySettings }>(
    `${BASE}/admin/data-residency`,
    {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(input),
    },
  );
}

export async function checkDataResidencyWrite(token: string) {
  return fetchWorkerJson<{ ok: boolean; workerRegion: string; error?: string }>(
    `${BASE}/admin/data-residency/check`,
    { headers: authHeaders(token) },
  );
}
