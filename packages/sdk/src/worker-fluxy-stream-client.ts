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

export interface LiveStreamViewer {
  id: string;
  eventId: string;
  projectId: string;
  userId: string;
  username: string | null;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  messageCount: number;
  isBanned: boolean;
  isMuted: boolean;
}

export interface StreamPinnedMessage {
  id: string;
  eventId: string;
  projectId: string;
  messageId: string | number;
  pinnedBy: string | null;
  pinnedAt: string;
  unpinnedAt: string | null;
  sortOrder: number;
}

export interface StreamChatMessage {
  id: string;
  eventId: string;
  projectId: string;
  userId: string;
  username: string | null;
  content: string;
  contentType: string;
  isHighlighted: boolean;
  isDeleted: boolean;
  deletedBy: string | null;
  deletedReason: string | null;
  badge: string | null;
  color: string | null;
  replyToId: string | number | null;
  createdAt: string;
}

export interface StreamAnalyticsBucket {
  id: string;
  eventId: string;
  projectId: string;
  timestampBucket: string;
  messagesCount: number;
  viewersCount: number;
  peakViewers: number;
  newViewers: number;
  uniqueChatters: number;
  avgMessageLength: number;
  engagementRate: number;
  createdAt?: string;
}

export interface StreamGift {
  id: string;
  eventId: string;
  projectId: string;
  userId: string;
  giftType: string;
  amount: number;
  currency: string;
  paymentStatus: string;
  createdAt: string;
}

export interface StreamSentimentBucket {
  id: string;
  eventId: string;
  projectId: string;
  timestampBucket: string;
  positive: number;
  neutral: number;
  negative: number;
  score: number;
  createdAt?: string;
}

export interface StreamChatRules {
  id: string;
  eventId: string;
  projectId?: string;
  slowModeSeconds: number;
  emoteOnly: boolean;
  subscriberOnly: boolean;
  followerOnly: boolean;
  followerMinutes: number;
  linkProtection: boolean;
  maxMessageLength: number;
  cooldownSeconds: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LiveStreamStats {
  events: Array<{ status: string; count: number }>;
  totalMessages: number;
  totalViewers: number;
}

export interface StreamTurnCredentials {
  iceServers: Array<{ urls: string; username?: string; credential?: string }>;
  ttl: number;
  note?: string;
}

export interface StreamModerationResult {
  ok: boolean;
  severity?: string;
  safe?: boolean;
  analysis?: unknown;
  error?: string;
}

export interface WorkerFluxyStreamClient {
  createEvent(input: { title: string; roomId?: string; description?: string; category?: string }): Promise<WorkerFluxyStreamEvent>;
  listEvents(filter?: { status?: StreamStatus; limit?: number }): Promise<WorkerFluxyStreamEvent[]>;
  getEvent(eventId: string): Promise<WorkerFluxyStreamEvent | null>;
  provision(eventId: string): Promise<WorkerFluxyStreamEvent>;
  join(eventId: string): Promise<{ id: string; alreadyJoined?: boolean }>;
  leave(eventId: string): Promise<{ left: number }>;
  goLive(eventId: string): Promise<{ updated: boolean }>;
  /** PATCH generic fields (title, description, status, streamUrl, thumbnailUrl, category, tags). */
  updateEvent(eventId: string, patch: {
    title?: string;
    description?: string;
    status?: StreamStatus;
    streamUrl?: string;
    thumbnailUrl?: string;
    category?: string;
    tags?: string[];
  }): Promise<{ updated: boolean }>;
  listAngles(eventId: string): Promise<CameraAngle[]>;
  createAngle(eventId: string, input: {
    label?: string;
    streamUrl?: string;
    sortOrder?: number;
    provisionCloudflare?: boolean;
  }): Promise<{ id: string; liveInputUid?: string | null; playbackHls?: string | null }>;
  listViewers(eventId: string, filter?: { role?: string; limit?: number }): Promise<LiveStreamViewer[]>;
  getViewerCount(eventId: string): Promise<{ count: number }>;
  getPeak(eventId: string): Promise<{ peakViewers: number; totalViewers: number }>;
  updatePeak(eventId: string): Promise<{ peakViewers: number }>;
  banViewer(eventId: string, userId: string): Promise<{ banned: boolean }>;
  muteViewer(eventId: string, userId: string, muted?: boolean): Promise<{ muted: boolean }>;
  pinMessage(eventId: string, messageId: string | number): Promise<{ id: string }>;
  unpinMessage(pinId: string): Promise<{ unpinned: boolean }>;
  listPinnedMessages(eventId: string): Promise<StreamPinnedMessage[]>;
  sendMessage(eventId: string, input: {
    content: string;
    username?: string;
    contentType?: string;
    badge?: string;
    color?: string;
    replyToId?: string | number;
  }): Promise<{ id: string }>;
  listMessages(eventId: string, filter?: { limit?: number; before?: string }): Promise<StreamChatMessage[]>;
  recordAnalytics(eventId: string, bucket: {
    timestampBucket: string;
    messagesCount?: number;
    viewersCount?: number;
    peakViewers?: number;
    newViewers?: number;
    uniqueChatters?: number;
    avgMessageLength?: number;
    engagementRate?: number;
  }): Promise<{ id: string }>;
  getAnalytics(eventId: string, filter?: { fromBucket?: string; toBucket?: string }): Promise<StreamAnalyticsBucket[]>;
  getStats(): Promise<LiveStreamStats>;
  getChatRules(eventId: string): Promise<StreamChatRules | null>;
  upsertChatRules(eventId: string, rules: {
    slowModeSeconds?: number;
    emoteOnly?: boolean;
    subscriberOnly?: boolean;
    followerOnly?: boolean;
    followerMinutes?: number;
    linkProtection?: boolean;
    maxMessageLength?: number;
    cooldownSeconds?: number;
  }): Promise<{ id: string; created?: boolean; updated?: boolean }>;
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
  createHighlight(eventId: string, input: {
    title?: string;
    startSeconds?: number;
    endSeconds?: number;
    reason?: string;
    clipUrl?: string;
  }): Promise<{ id: string }>;
  listGifts(eventId: string): Promise<StreamGift[]>;
  sendGift(eventId: string, input?: { giftType?: string; amount?: number; currency?: string }): Promise<{ id: string }>;
  getSentiment(eventId: string): Promise<StreamSentimentBucket[]>;
  listReplays(eventId: string): Promise<StreamReplay[]>;
  getReplayBundle(eventId: string): Promise<StreamReplayBundle>;
  getPrimaryReplay(eventId: string): Promise<StreamReplay | null>;
  registerReplay(eventId: string, input: { playbackHls: string; label?: string; playbackDash?: string; thumbnailUrl?: string; durationSeconds?: number }): Promise<StreamReplay>;
  reconcileReplays(eventId: string): Promise<{ replays: StreamReplay[]; synced: number; syncGroupId?: string }>;
  reconcileAngleReplays(eventId: string): Promise<{ replays: StreamReplay[]; synced: number; syncGroupId?: string }>;
  deleteInput(eventId: string): Promise<{ deleted: boolean }>;
  getTurnCredentials(): Promise<StreamTurnCredentials>;
  moderateFrame(eventId: string, input: {
    imageBase64: string;
    roomId?: string;
    frameIndex?: number;
    messageId?: number;
  }): Promise<StreamModerationResult>;
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
      return (await res.json()) as { id: string; alreadyJoined?: boolean };
    },
    async goLive(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ status: "live" }),
      });
      if (!res.ok) throw new Error(`goLive failed: ${res.status}`);
      return (await res.json()) as { updated: boolean };
    },
    async updateEvent(eventId, patch) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`updateEvent failed: ${res.status}`);
      return (await res.json()) as { updated: boolean };
    },
    async listAngles(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/angles`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listAngles failed: ${res.status}`);
      const body = (await res.json()) as CameraAngle[] | { angles?: CameraAngle[] };
      return Array.isArray(body) ? body : body.angles ?? [];
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
      const body = (await res.json()) as StreamHighlight[] | { highlights?: StreamHighlight[] };
      return Array.isArray(body) ? body : body.highlights ?? [];
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
    async leave(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`leave failed: ${res.status}`);
      return (await res.json()) as { left: number };
    },
    async listViewers(eventId, filter) {
      const url = new URL(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/viewers`);
      if (filter?.role) url.searchParams.set("role", filter.role);
      if (filter?.limit) url.searchParams.set("limit", String(filter.limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listViewers failed: ${res.status}`);
      return (await res.json()) as LiveStreamViewer[];
    },
    async getViewerCount(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/viewer-count`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getViewerCount failed: ${res.status}`);
      return (await res.json()) as { count: number };
    },
    async getPeak(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/peak`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getPeak failed: ${res.status}`);
      return (await res.json()) as { peakViewers: number; totalViewers: number };
    },
    async updatePeak(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/peak`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`updatePeak failed: ${res.status}`);
      return (await res.json()) as { peakViewers: number };
    },
    async banViewer(eventId, userId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error(`banViewer failed: ${res.status}`);
      return (await res.json()) as { banned: boolean };
    },
    async muteViewer(eventId, userId, muted = true) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/mute`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ userId, muted }),
      });
      if (!res.ok) throw new Error(`muteViewer failed: ${res.status}`);
      return (await res.json()) as { muted: boolean };
    },
    async pinMessage(eventId, messageId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) throw new Error(`pinMessage failed: ${res.status}`);
      return (await res.json()) as { id: string };
    },
    async unpinMessage(pinId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(pinId)}/unpin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ pinId }),
      });
      if (!res.ok) throw new Error(`unpinMessage failed: ${res.status}`);
      return (await res.json()) as { unpinned: boolean };
    },
    async listPinnedMessages(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/pinned`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listPinnedMessages failed: ${res.status}`);
      return (await res.json()) as StreamPinnedMessage[];
    },
    async sendMessage(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`sendMessage failed: ${res.status}`);
      return (await res.json()) as { id: string };
    },
    async listMessages(eventId, filter) {
      const url = new URL(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/messages`);
      if (filter?.limit) url.searchParams.set("limit", String(filter.limit));
      if (filter?.before) url.searchParams.set("before", filter.before);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listMessages failed: ${res.status}`);
      return (await res.json()) as StreamChatMessage[];
    },
    async recordAnalytics(eventId, bucket) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/analytics`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(bucket),
      });
      if (!res.ok) throw new Error(`recordAnalytics failed: ${res.status}`);
      return (await res.json()) as { id: string };
    },
    async getAnalytics(eventId, filter) {
      const url = new URL(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/analytics`);
      if (filter?.fromBucket) url.searchParams.set("fromBucket", filter.fromBucket);
      if (filter?.toBucket) url.searchParams.set("toBucket", filter.toBucket);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`getAnalytics failed: ${res.status}`);
      return (await res.json()) as StreamAnalyticsBucket[];
    },
    async getStats() {
      const res = await fetch(`${base(client)}/api/live/stats`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`getStats failed: ${res.status}`);
      return (await res.json()) as LiveStreamStats;
    },
    async createAngle(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/angles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createAngle failed: ${res.status}`);
      return (await res.json()) as { id: string; liveInputUid?: string | null; playbackHls?: string | null };
    },
    async createHighlight(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createHighlight failed: ${res.status}`);
      return (await res.json()) as { id: string };
    },
    async listGifts(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/gifts`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listGifts failed: ${res.status}`);
      return (await res.json()) as StreamGift[];
    },
    async sendGift(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/gifts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input ?? {}),
      });
      if (!res.ok) throw new Error(`sendGift failed: ${res.status}`);
      return (await res.json()) as { id: string };
    },
    async getSentiment(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/sentiment`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getSentiment failed: ${res.status}`);
      return (await res.json()) as StreamSentimentBucket[];
    },
    async getChatRules(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/rules`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getChatRules failed: ${res.status}`);
      return (await res.json()) as StreamChatRules | null;
    },
    async upsertChatRules(eventId, rules) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(rules),
      });
      if (!res.ok) throw new Error(`upsertChatRules failed: ${res.status}`);
      return (await res.json()) as { id: string; created?: boolean; updated?: boolean };
    },
    async deleteInput(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/input`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`deleteInput failed: ${res.status}`);
      return (await res.json()) as { deleted: boolean };
    },
    async getTurnCredentials() {
      const res = await fetch(`${base(client)}/api/live/turn-credentials`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`getTurnCredentials failed: ${res.status}`);
      return (await res.json()) as StreamTurnCredentials;
    },
    async moderateFrame(eventId, input) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/moderate-frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`moderateFrame failed: ${res.status}`);
      return (await res.json()) as StreamModerationResult;
    },
    async getPrimaryReplay(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replay/primary`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getPrimaryReplay failed: ${res.status}`);
      const body = (await res.json()) as { replay: StreamReplay | null };
      return body.replay;
    },
    async reconcileAngleReplays(eventId) {
      const res = await fetch(`${base(client)}/api/live/events/${encodeURIComponent(eventId)}/replays/reconcile-angles`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`reconcileAngleReplays failed: ${res.status}`);
      return (await res.json()) as { replays: StreamReplay[]; synced: number; syncGroupId?: string };
    },
  };
}
