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

/** Offline fallback when room autocomplete is unavailable (guest demo, WS-only JWT). */
export function localMentionSuggestions(
  query = "",
  agentHandle = "assistant",
): MentionSuggestion[] {
  const handle = agentHandle.replace(/^@/, "");
  const base: MentionSuggestion[] = [
    {
      id: "special:here",
      label: "@here",
      description: "Notify active members in this room",
      kind: "special",
    },
    {
      id: "special:channel",
      label: "@channel",
      description: "Notify everyone in this room",
      kind: "special",
    },
    {
      id: `agent:${handle}`,
      label: `@${handle}`,
      description: "Mention the assistant agent",
      kind: "user",
    },
  ];
  const q = query.trim().toLowerCase();
  if (!q) return base;
  return base.filter(
    (s) =>
      s.label.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q),
  );
}
