import type { RoomEvent } from "./vertical-platform";

export interface CapabilityClientConfig {
  baseUrl: string;
  token: string;
}

export interface PublishCapabilityInput {
  roomId: string;
  vertical?: string;
  type: string;
  actor: RoomEvent["actor"];
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  occurredAt?: string;
}

export interface CapabilityClient {
  publish(input: PublishCapabilityInput): Promise<{ ok: boolean; event?: RoomEvent; deduplicated?: boolean; error?: string }>;
  list(roomId: string, afterCursor?: number): Promise<{ ok: boolean; events?: RoomEvent[]; cursor?: number; hasMore?: boolean; error?: string }>;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

export function createCapabilityClient(config: CapabilityClientConfig): CapabilityClient {
  const base = normalizeBaseUrl(config.baseUrl);

  async function publish(input: PublishCapabilityInput) {
    const res = await fetch(`${base}/rooms/${encodeURIComponent(input.roomId)}/capabilities/events`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        vertical: input.vertical,
        type: input.type,
        actor: input.actor,
        idempotencyKey: input.idempotencyKey,
        payload: input.payload ?? {},
        occurredAt: input.occurredAt,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "publish_failed" };
    return data as { ok: boolean; event?: RoomEvent; deduplicated?: boolean };
  }

  async function list(roomId: string, afterCursor = 0) {
    const url = new URL(`${base}/rooms/${encodeURIComponent(roomId)}/capabilities/events`);
    url.searchParams.set("afterCursor", String(afterCursor));
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: (data as { error?: string }).error || "list_failed" };
    return data as { ok: boolean; events?: RoomEvent[]; cursor?: number; hasMore?: boolean };
  }

  return { publish, list };
}

export async function syncWorkflowEventsToWorker(
  client: CapabilityClient,
  events: RoomEvent[],
  vertical?: string,
): Promise<{ synced: number; errors: number }> {
  let synced = 0;
  let errors = 0;
  for (const event of events) {
    const result = await client.publish({
      roomId: event.roomId,
      vertical,
      type: event.type,
      actor: event.actor,
      idempotencyKey: event.idempotencyKey,
      payload: event.payload as Record<string, unknown>,
      occurredAt: event.occurredAt,
    });
    if (result.ok) synced += 1;
    else errors += 1;
  }
  return { synced, errors };
}
