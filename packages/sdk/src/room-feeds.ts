export type FluxyFeedKind = "activity" | "agent" | "automation";

export interface FluxyFeed {
  id: string;
  roomId: string;
  name: string;
  kind: FluxyFeedKind | string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface FluxyFeedMessageMetadata {
  source?: string;
  agentId?: string;
  status?: string;
}

export interface FluxyFeedMessage {
  id: string;
  feedId: string;
  roomId: string;
  userId: string;
  body: string;
  metadata: FluxyFeedMessageMetadata;
  createdAt: string;
}

export function mergeFeed(feeds: FluxyFeed[], incoming: FluxyFeed): FluxyFeed[] {
  const idx = feeds.findIndex((f) => f.id === incoming.id);
  if (idx < 0) return [...feeds, incoming];
  const next = [...feeds];
  next[idx] = incoming;
  return next;
}

export function appendFeedMessage(
  messages: FluxyFeedMessage[],
  incoming: FluxyFeedMessage,
): FluxyFeedMessage[] {
  if (messages.some((m) => m.id === incoming.id)) return messages;
  return [...messages, incoming];
}
