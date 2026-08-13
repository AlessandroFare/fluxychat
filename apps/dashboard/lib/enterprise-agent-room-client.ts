import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function provisionEnterpriseAgentRoom(token: string, name: string) {
  return fetchWorkerJson<{
    ok: boolean;
    packId: string;
    room: { id: string; name: string };
    features: Array<{ id: string; label: string; path: string }>;
  }>(`${BASE}/packs/enterprise-agent-room`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ name }),
  });
}
