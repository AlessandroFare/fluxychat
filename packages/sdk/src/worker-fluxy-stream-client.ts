import type { FluxyChatClient } from "./index";
import type { CameraAngle, LiveProduct, StreamHighlight, StreamStatus } from "./fluxy-stream";

export interface WorkerFluxyStreamEvent {
  id: string;
  title: string;
  status: StreamStatus;
  roomId?: string;
  streamUrl?: string;
  playbackHls?: string;
  peakViewers?: number;
  totalViewers?: number;
}

export interface WorkerFluxyStreamClient {
  createEvent(input: { title: string; roomId?: string; description?: string; category?: string }): Promise<WorkerFluxyStreamEvent>;
  listEvents(filter?: { status?: StreamStatus; limit?: number }): Promise<WorkerFluxyStreamEvent[]>;
  getEvent(eventId: string): Promise<WorkerFluxyStreamEvent | null>;
  provision(eventId: string): Promise<WorkerFluxyStreamEvent>;
  join(eventId: string): Promise<{ ok: boolean }>;
  goLive(eventId: string): Promise<WorkerFluxyStreamEvent>;
  listAngles(eventId: string): Promise<CameraAngle[]>;
  listProducts(eventId: string): Promise<LiveProduct[]>;
  listHighlights(eventId: string): Promise<StreamHighlight[]>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

function mapEvent(row: Record<string, unknown>): WorkerFluxyStreamEvent {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    status: String(row.status ?? "scheduled") as StreamStatus,
    roomId: row.roomId ? String(row.roomId) : row.room_id ? String(row.room_id) : undefined,
    streamUrl: row.streamUrl ? String(row.streamUrl) : row.stream_url ? String(row.stream_url) : undefined,
    playbackHls: row.playbackHls ? String(row.playbackHls) : row.playback_hls ? String(row.playback_hls) : undefined,
    peakViewers: row.peakViewers != null ? Number(row.peakViewers) : row.peak_viewers != null ? Number(row.peak_viewers) : undefined,
    totalViewers: row.totalViewers != null ? Number(row.totalViewers) : row.total_viewers != null ? Number(row.total_viewers) : undefined,
  };
}

export function createWorkerFluxyStreamClient(client: FluxyChatClient): WorkerFluxyStreamClient {
  return {
    async createEvent(input) {
      const res = await fetch(`${base(client)}/api/live/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createEvent failed: ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      return mapEvent(body.event && typeof body.event === "object" ? (body.event as Record<string, unknown>) : body);
    },
    async listEvents(filter) {
      const url = new URL(`${base(client)}/api/live/events`);
      if (filter?.status) url.searchParams.set("status", filter.status);
      if (filter?.limit) url.searchParams.set("limit", String(filter.limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listEvents failed: ${res.status}`);
      const body = (await res.json()) as { events?: Array<Record<string, unknown>> };
      return (body.events ?? []).map(mapEvent);
    },
    async getEvent(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}`, {
        headers: await headers(client),
      });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`getEvent failed: ${res.status}`);
      return mapEvent((await res.json()) as Record<string, unknown>);
    },
    async provision(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/provision`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`provision failed: ${res.status}`);
      return mapEvent((await res.json()) as Record<string, unknown>);
    },
    async join(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`join failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async goLive(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ status: "live" }),
      });
      if (!res.ok) throw new Error(`goLive failed: ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      return mapEvent(body.event && typeof body.event === "object" ? (body.event as Record<string, unknown>) : body);
    },
    async listAngles(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/angles`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listAngles failed: ${res.status}`);
      const body = (await res.json()) as { angles?: CameraAngle[] };
      return body.angles ?? [];
    },
    async listProducts(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/products`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listProducts failed: ${res.status}`);
      const body = (await res.json()) as { products?: LiveProduct[] };
      return body.products ?? [];
    },
    async listHighlights(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/highlights`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listHighlights failed: ${res.status}`);
      const body = (await res.json()) as { highlights?: StreamHighlight[] };
      return body.highlights ?? [];
    },
  };
}
