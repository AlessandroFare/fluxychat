import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface PublicGuestHardeningConfig {
  ok: boolean;
  publicGuestEnabled: boolean;
  readOnlyGuest: boolean;
  rateLimitPerMinute: number;
  turnstile: {
    configured: boolean;
    required: boolean;
    siteKey: string | null;
  };
}

export async function fetchPublicGuestHardening(): Promise<PublicGuestHardeningConfig> {
  return fetchWorkerJson(`${BASE}/public/guest-hardening`);
}
