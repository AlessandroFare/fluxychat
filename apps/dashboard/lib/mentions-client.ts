import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import type { MentionSuggestion } from "~/components/ui/mention-menu";

const BASE = getPublicWorkerUrl();

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchMentionSuggestions(
  token: string,
  roomId: string,
  query = "",
): Promise<MentionSuggestion[]> {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  const qs = params.toString();
  const data = await fetchWorkerJson<{ suggestions: MentionSuggestion[] }>(
    `${BASE}/rooms/${encodeURIComponent(roomId)}/mentions/autocomplete${qs ? `?${qs}` : ""}`,
    { headers: authHeaders(token) },
  );
  return data.suggestions ?? [];
}
