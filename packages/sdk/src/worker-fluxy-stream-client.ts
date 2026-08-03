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

export interface StreamReplay {
  id: string;
  eventId?: string;
  source: "cloudflare" | "manual";
  label?: string;
  playbackHls?: string;
  playbackDash?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  status: "processing" | "ready" | "failed";
  isPrimary?: boolean;
  angleId?: string;
  syncGroupId?: string;
  offsetMs?: number;
  createdAt?: string;
  readyAt?: string;
}

export interface StreamAngleReplay {
  angleId: string;
  label: string;
  sortOrder: number;
  replay: StreamReplay;
  offsetMs: number;
}

export interface StreamReplayBundle {
  replay: StreamReplay | null;
  angleReplays: StreamAngleReplay[];
  syncGroupId: string | null;
  chatTimeline: Array<{ id: string; username?: string; content: string; createdAt: string }>;
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
  upsertProduct(eventId: string, input: {
    id?: string;
    name: string;
    checkoutUrl?: string;
    stripePriceId?: string;
    checkoutProvider?: "external" | "stripe";
    priceAmount?: number;
    currency?: string;
    description?: string;
    imageUrl?: string;
    inventoryQty?: number | null;
    moq?: number;
  }): Promise<LiveProduct>;
  showProduct(eventId: string, productId: string): Promise<LiveProduct>;
  recordCheckoutClick(eventId: string, productId: string, quantity?: number, options?: {
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    checkoutUrl: string;
    checkoutProvider?: "external" | "stripe";
    paymentStatus?: "pending" | "paid";
    sessionId?: string;
    quantity: number;
    product: LiveProduct;
  }>;
  listHighlights(eventId: string): Promise<StreamHighlight[]>;
  listReplays(eventId: string): Promise<StreamReplay[]>;
  getReplayBundle(eventId: string): Promise<StreamReplayBundle>;
  registerReplay(eventId: string, input: { playbackHls: string; label?: string; playbackDash?: string; thumbnailUrl?: string; durationSeconds?: number }): Promise<StreamReplay>;
  reconcileReplays(eventId: string): Promise<{ replays: StreamReplay[]; synced: number; syncGroupId?: string }>;
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

function mapProduct(row: Record<string, unknown>): LiveProduct {
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    description: row.description ? String(row.description) : undefined,
    imageUrl: row.imageUrl ? String(row.imageUrl) : row.image_url ? String(row.image_url) : undefined,
    checkoutUrl: String(row.checkoutUrl ?? row.checkout_url ?? ""),
    checkoutProvider: (row.checkoutProvider ?? row.checkout_provider ?? "external") as "external" | "stripe",
    stripePriceId: row.stripePriceId ? String(row.stripePriceId) : row.stripe_price_id ? String(row.stripe_price_id) : undefined,
    priceAmount: Number(row.priceAmount ?? row.price_amount ?? 0),
    currency: String(row.currency ?? "usd"),
    active: Boolean(row.active),
    shownAt: row.shownAt ? String(row.shownAt) : row.shown_at ? String(row.shown_at) : undefined,
    inventoryQty: row.inventoryQty != null ? Number(row.inventoryQty) : row.inventory_qty != null ? Number(row.inventory_qty) : null,
    moq: row.moq != null ? Number(row.moq) : undefined,
    unitsSold: row.unitsSold != null ? Number(row.unitsSold) : row.units_sold != null ? Number(row.units_sold) : undefined,
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
      const body = (await res.json()) as LiveProduct[] | { products?: LiveProduct[] };
      const rows = Array.isArray(body) ? body : body.products ?? [];
      return rows.map((row) => mapProduct(row as unknown as Record<string, unknown>));
    },
    async upsertProduct(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`upsertProduct failed: ${res.status}`);
      const body = (await res.json()) as { product: Record<string, unknown> };
      return mapProduct(body.product);
    },
    async showProduct(eventId, productId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/products/${encodeURIComponent(productId)}/show`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`showProduct failed: ${res.status}`);
      const body = (await res.json()) as { product: Record<string, unknown> };
      return mapProduct(body.product);
    },
    async recordCheckoutClick(eventId, productId, quantity, options) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/products/${encodeURIComponent(productId)}/checkout-click`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ quantity, successUrl: options?.successUrl, cancelUrl: options?.cancelUrl }),
      });
      if (!res.ok) throw new Error(`recordCheckoutClick failed: ${res.status}`);
      const body = (await res.json()) as {
        checkoutUrl: string;
        checkoutProvider?: "external" | "stripe";
        paymentStatus?: "pending" | "paid";
        sessionId?: string;
        quantity: number;
        product: Record<string, unknown>;
      };
      return {
        checkoutUrl: body.checkoutUrl,
        checkoutProvider: body.checkoutProvider,
        paymentStatus: body.paymentStatus,
        sessionId: body.sessionId,
        quantity: body.quantity,
        product: mapProduct(body.product),
      };
    },
    async listHighlights(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/highlights`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listHighlights failed: ${res.status}`);
      const body = (await res.json()) as { highlights?: StreamHighlight[] };
      return body.highlights ?? [];
    },
    async listReplays(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replays`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listReplays failed: ${res.status}`);
      const body = (await res.json()) as { replays?: StreamReplay[] };
      return body.replays ?? [];
    },
    async getReplayBundle(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replay`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getReplayBundle failed: ${res.status}`);
      return (await res.json()) as StreamReplayBundle;
    },
    async registerReplay(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replays`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`registerReplay failed: ${res.status}`);
      const body = (await res.json()) as { replay: StreamReplay };
      return body.replay;
    },
    async reconcileReplays(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replays/reconcile`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`reconcileReplays failed: ${res.status}`);
      return (await res.json()) as { replays: StreamReplay[]; synced: number; syncGroupId?: string };
    },
  };
}
