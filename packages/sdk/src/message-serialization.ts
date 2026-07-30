import type { FluxyChatMessage, FluxyChatAttachment } from "./index";

export interface SerializedMessage {
  v: number;
  id: number;
  roomId: string;
  userId: string;
  content: string;
  createdAt: string;
  parentId?: number | null;
  editedAt?: string | null;
  deletedAt?: string | null;
  mentions?: string[];
  attachments?: Array<{
    id: number;
    kind: string;
    url: string;
    name: string;
    sizeBytes?: number;
    contentType?: string;
  }>;
  metadata?: Record<string, unknown>;
}

export function serializeMessage(msg: FluxyChatMessage): SerializedMessage {
  return {
    v: 1,
    id: msg.id,
    roomId: msg.roomId,
    userId: msg.userId,
    content: msg.content,
    createdAt: msg.createdAt,
    parentId: msg.parentId,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    mentions: msg.mentions,
    attachments: msg.attachments?.map((a) => ({
      id: a.id ?? 0,
      kind: a.kind,
      url: a.url,
      name: a.name,
      sizeBytes: a.sizeBytes,
      contentType: a.contentType,
    })),
    metadata: (msg as any).metadata,
  };
}

export function deserializeMessage(data: SerializedMessage): FluxyChatMessage {
  if (data.v !== 1) throw new Error(`Unsupported version: ${data.v}`);

  const msg: FluxyChatMessage & { metadata?: Record<string, unknown> } = {
    id: data.id,
    roomId: data.roomId,
    userId: data.userId,
    content: data.content,
    createdAt: data.createdAt,
  };
  if (data.parentId != null) msg.parentId = data.parentId;
  if (data.editedAt != null) msg.editedAt = data.editedAt;
  if (data.deletedAt != null) msg.deletedAt = data.deletedAt;
  if (data.mentions) msg.mentions = data.mentions;
  if (data.attachments) msg.attachments = data.attachments.map((a) => ({
    id: a.id,
    kind: a.kind as FluxyChatAttachment["kind"],
    url: a.url,
    name: a.name,
    sizeBytes: a.sizeBytes,
    contentType: a.contentType,
  }));
  if (data.metadata) msg.metadata = data.metadata;
  return msg as FluxyChatMessage;
}

export function messageToJSON(msg: FluxyChatMessage): string {
  return JSON.stringify(serializeMessage(msg));
}

export function messageFromJSON(json: string): FluxyChatMessage {
  return deserializeMessage(JSON.parse(json));
}
