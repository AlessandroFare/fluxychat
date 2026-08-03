import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface RoomCommand {
  id?: string;
  command: string;
  description: string;
  usage?: string;
  handler?: string;
  required_role?: string;
  enabled?: number | boolean;
  config_json?: string | null;
  project_id?: string;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

export async function listSlashCommands(token: string): Promise<{ commands: RoomCommand[] }> {
  return fetchWorkerJson(`${BASE}/commands`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getSlashCommandSuggestions(
  token: string,
  partial: string,
): Promise<{ suggestions: Array<{ command: string; description: string; usage?: string }> }> {
  const url = new URL(`${BASE}/commands/autocomplete`);
  url.searchParams.set("q", partial);
  return fetchWorkerJson(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function listCustomSlashCommands(token: string): Promise<{ commands: RoomCommand[] }> {
  return fetchWorkerJson(`${BASE}/admin/room-commands`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function createCustomSlashCommand(
  token: string,
  input: {
    command: string;
    description: string;
    usage?: string;
    handler?: string;
    requiredRole?: string;
    config?: { responseTemplate?: string };
  },
): Promise<{ ok: boolean; command?: RoomCommand }> {
  return fetchWorkerJson(`${BASE}/admin/room-commands`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}

export async function updateCustomSlashCommand(
  token: string,
  commandId: string,
  patch: Partial<{
    description: string;
    usage: string;
    handler: string;
    requiredRole: string;
    enabled: boolean;
    config: { responseTemplate?: string };
  }>,
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/room-commands/${encodeURIComponent(commandId)}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
}

export async function deleteCustomSlashCommand(
  token: string,
  commandId: string,
): Promise<{ ok: boolean }> {
  return fetchWorkerJson(`${BASE}/admin/room-commands/${encodeURIComponent(commandId)}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
}

export async function executeSlashCommand(
  token: string,
  input: { roomId: string; content: string; parentId?: number | null },
): Promise<Record<string, unknown>> {
  return fetchWorkerJson(`${BASE}/commands/execute`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
}
