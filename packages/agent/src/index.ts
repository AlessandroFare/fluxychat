import {
  FluxyChatClient,
  FluxyChatRoomConnection,
  FluxyMessageStream,
  type FluxyChatEvent,
  type FluxyChatMessage,
  type FluxyRoomConnectionOptions,
  type FluxyWaitForOptions,
} from "@fluxychat/sdk";
import { mintWorkerToken } from "./mint";

export {
  FluxyAuthError,
  FluxyConnectionError,
  FluxySendError,
  FluxyTimeoutError,
} from "@fluxychat/sdk";

export { mintWorkerToken, type MintTokenInput, type MintTokenResult } from "./mint";

const DEFAULT_BASE_URL = "http://127.0.0.1:8787";

export interface FluxyAgentConfig {
  /** Agent id — used as JWT `sub` / message `userId` (must match a row in `agents` for invoke). */
  id: string;
  name: string;
  /** Project API key (`fc_…`) from the Worker / console. */
  apiKey: string;
  baseUrl?: string;
  /** JWT roles (default `["member"]`). Use `["admin"]` only for bootstrap helpers. */
  roles?: string[];
  tokenTtlSeconds?: number;
}

export interface FluxyAgentJoinOptions {
  /** POST /rooms/:id/members with a short-lived admin token if the agent is not in the room yet. */
  ensureMembership?: boolean;
  connection?: FluxyRoomConnectionOptions;
}

export class FluxyRoom {
  readonly id: string;

  constructor(roomId: string) {
    this.id = roomId;
  }
}

type RoomListener = (message: FluxyChatMessage) => void;

export class FluxyAgent {
  readonly id: string;
  readonly name: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly roles: string[];
  private readonly tokenTtlSeconds: number;

  private token: string | null = null;
  private client: FluxyChatClient | null = null;
  private readonly connections = new Map<string, FluxyChatRoomConnection>();
  private readonly roomListeners = new Map<string, Set<RoomListener>>();

  constructor(config: FluxyAgentConfig) {
    if (!config.id?.trim()) throw new Error("FluxyAgent requires id");
    if (!config.apiKey?.trim()) throw new Error("FluxyAgent requires apiKey");
    this.id = config.id.trim();
    this.name = config.name?.trim() || this.id;
    this.apiKey = config.apiKey.trim();
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.roles = config.roles?.length ? config.roles : ["member"];
    this.tokenTtlSeconds = config.tokenTtlSeconds ?? 3600;
  }

  /** Mint JWT via Worker `POST /auth/token` and prepare REST/WS client. */
  async init(): Promise<this> {
    const minted = await mintWorkerToken({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      userId: this.id,
      roles: this.roles,
      ttlSeconds: this.tokenTtlSeconds,
    });
    this.token = minted.token;
    this.client = new FluxyChatClient({
      baseUrl: this.baseUrl,
      userId: this.id,
      token: this.token,
      apiKey: this.apiKey,
    });
    return this;
  }

  getClient(): FluxyChatClient {
    if (!this.client || !this.token) {
      throw new Error("Call init() before using the agent client.");
    }
    return this.client;
  }

  room(roomId: string): FluxyRoom {
    return new FluxyRoom(roomId);
  }

  async join(room: FluxyRoom | string, options: FluxyAgentJoinOptions = {}): Promise<void> {
    const roomId = typeof room === "string" ? room : room.id;
    if (this.connections.has(roomId)) return;

    if (options.ensureMembership) {
      await this.ensureRoomMembership(roomId);
    }

    const client = this.getClient();
    const connection = client.connectRoom(roomId, options.connection);
    connection.addEventListener("message", (event) => {
      if (event.type !== "message") return;
      const listeners = this.roomListeners.get(roomId);
      if (!listeners) return;
      for (const cb of listeners) {
        try {
          cb(event);
        } catch {
          /* ignore listener errors */
        }
      }
    });
    this.connections.set(roomId, connection);
    connection.connect();
  }

  leave(room: FluxyRoom | string): void {
    const roomId = typeof room === "string" ? room : room.id;
    const connection = this.connections.get(roomId);
    if (!connection) return;
    connection.close();
    this.connections.delete(roomId);
    this.roomListeners.delete(roomId);
  }

  disconnect(): void {
    for (const connection of this.connections.values()) {
      connection.close();
    }
    this.connections.clear();
    this.roomListeners.clear();
  }

  on(room: FluxyRoom | string, callback: RoomListener): void {
    const roomId = typeof room === "string" ? room : room.id;
    const set = this.roomListeners.get(roomId) ?? new Set<RoomListener>();
    set.add(callback);
    this.roomListeners.set(roomId, set);
  }

  off(room: FluxyRoom | string, callback: RoomListener): void {
    const roomId = typeof room === "string" ? room : room.id;
    const set = this.roomListeners.get(roomId);
    if (!set) return;
    set.delete(callback);
    if (set.size === 0) this.roomListeners.delete(roomId);
  }

  send(room: FluxyRoom | string, content: string, replyTo?: number | null): void {
    const roomId = typeof room === "string" ? room : room.id;
    const connection = this.getConnection(roomId, "send");
    connection.sendJson({
      type: "message",
      userId: this.id,
      content,
      parentId: replyTo ?? null,
      attachments: [],
    });
  }

  createStream(
    room: FluxyRoom | string,
    options?: { parentId?: number | null; flushIntervalMs?: number },
  ): FluxyMessageStream {
    const roomId = typeof room === "string" ? room : room.id;
    const connection = this.getConnection(roomId, "createStream");
    return new FluxyMessageStream(connection, this.id, {
      parentId: options?.parentId ?? null,
      flushIntervalMs: options?.flushIntervalMs,
    });
  }

  waitFor(
    room: FluxyRoom | string,
    predicate: (message: FluxyChatMessage) => boolean,
    options?: FluxyWaitForOptions,
  ): Promise<FluxyChatMessage> {
    const roomId = typeof room === "string" ? room : room.id;
    const connection = this.getConnection(roomId, "waitFor");
    return connection.waitFor(
      (event: FluxyChatEvent) => event.type === "message" && predicate(event),
      options,
    );
  }

  async invoke(
    room: FluxyRoom | string,
    content: string,
    options?: { replyTo?: number | null },
  ): Promise<Awaited<ReturnType<FluxyChatClient["invokeAgentRest"]>>> {
    const roomId = typeof room === "string" ? room : room.id;
    return this.getClient().invokeAgentRest(this.id, roomId, content, {
      replyTo: options?.replyTo,
    });
  }

  private getConnection(roomId: string, op: string): FluxyChatRoomConnection {
    const connection = this.connections.get(roomId);
    if (!connection) {
      throw new Error(
        `Agent "${this.id}" has not joined room "${roomId}". Call join() before ${op}().`,
      );
    }
    return connection;
  }

  private async ensureRoomMembership(roomId: string): Promise<void> {
    const admin = await mintWorkerToken({
      baseUrl: this.baseUrl,
      apiKey: this.apiKey,
      userId: this.id,
      roles: ["admin"],
      ttlSeconds: 120,
    });
    const adminClient = new FluxyChatClient({
      baseUrl: this.baseUrl,
      userId: this.id,
      token: admin.token,
    });
    try {
      await adminClient.addRoomMember(roomId, this.id, "member");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!message.includes("409") && !message.toLowerCase().includes("already")) {
        throw err;
      }
    }
  }
}

export async function createFluxyAgent(config: FluxyAgentConfig): Promise<FluxyAgent> {
  const agent = new FluxyAgent(config);
  await agent.init();
  return agent;
}

export type { FluxyChatMessage, FluxyMessageStream, FluxyWaitForOptions };
