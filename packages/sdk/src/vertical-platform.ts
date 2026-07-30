export type VerticalId = "edu" | "health" | "event" | "finance" | "continuity";
export type CapabilityId =
  | "chat" | "presence" | "video" | "whiteboard" | "poll" | "attendance"
  | "clinical-data" | "ticket" | "market-data" | "spatial" | "device-shadow";
export type PlatformReadiness = "production" | "beta" | "prototype" | "preview";

export interface EventActor {
  id: string;
  type: "user" | "agent" | "device" | "system";
  role?: string;
}

export interface RoomEvent<TPayload = unknown> {
  eventId: string;
  workspaceId: string;
  roomId: string;
  type: string;
  actor: EventActor;
  occurredAt: string;
  schemaVersion: 1;
  idempotencyKey: string;
  payload: TPayload;
}

export interface RoomPolicy {
  allowedRoles: string[];
  retentionDays: number;
  consentRequired?: boolean;
  allowExport?: boolean;
}

export interface CapabilityDefinition {
  id: CapabilityId;
  readiness: PlatformReadiness;
  policy: RoomPolicy;
}

export interface RoomKernelConfig {
  workspaceId: string;
  roomId: string;
  vertical: VerticalId;
  capabilities: CapabilityDefinition[];
}

export interface DeviceCapabilities {
  deviceId: string;
  formFactor: "desktop" | "mobile" | "tablet" | "xr" | "embedded";
  input: Array<"keyboard" | "touch" | "voice" | "controller" | "gaze">;
  supportsVideo: boolean;
  supportsSpatial: boolean;
  maxViewportWidth: number;
}

export interface SessionCheckpoint {
  checkpointId: string;
  roomId: string;
  actorId: string;
  cursor: number;
  activeCapability: CapabilityId;
  viewState: Record<string, unknown>;
  createdAt: string;
  expiresAt: string;
}

export interface PollDefinition {
  id: string;
  question: string;
  options: Array<{ id: string; label: string }>;
  allowMultiple: boolean;
  status: "open" | "closed";
}

export interface PollVote {
  pollId: string;
  optionIds: string[];
  userId: string;
  idempotencyKey: string;
}

export interface VerticalPlatform {
  readonly config: Readonly<RoomKernelConfig>;
  publish<T>(event: Omit<RoomEvent<T>, "eventId" | "occurredAt" | "schemaVersion">): RoomEvent<T>;
  events(afterCursor?: number): readonly RoomEvent[];
  createPoll(input: Omit<PollDefinition, "id" | "status">): PollDefinition;
  vote(input: PollVote): boolean;
  closePoll(pollId: string): boolean;
  pollResults(pollId: string): Readonly<Record<string, number>>;
  checkpoint(input: Omit<SessionCheckpoint, "checkpointId" | "createdAt">): SessionCheckpoint;
}

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function assertText(value: string, field: string): void {
  if (!value.trim()) throw new Error(`${field} is required`);
}

export function createVerticalPlatform(config: RoomKernelConfig): VerticalPlatform {
  assertText(config.workspaceId, "workspaceId");
  assertText(config.roomId, "roomId");
  const eventLog: RoomEvent[] = [];
  const idempotency = new Set<string>();
  const polls = new Map<string, PollDefinition>();
  const votes = new Map<string, Map<string, Set<string>>>();
  const checkpoints = new Map<string, SessionCheckpoint>();
  const immutableConfig = structuredClone(config);

  function publish<T>(input: Omit<RoomEvent<T>, "eventId" | "occurredAt" | "schemaVersion">): RoomEvent<T> {
    if (input.workspaceId !== config.workspaceId || input.roomId !== config.roomId) {
      throw new Error("Event tenant or room does not match this kernel");
    }
    assertText(input.idempotencyKey, "idempotencyKey");
    const existing = eventLog.find((event) => event.idempotencyKey === input.idempotencyKey);
    if (existing) return existing as RoomEvent<T>;
    const event: RoomEvent<T> = Object.freeze({
      ...structuredClone(input), eventId: id("evt"), occurredAt: new Date().toISOString(), schemaVersion: 1,
    });
    eventLog.push(event);
    idempotency.add(input.idempotencyKey);
    return event;
  }

  function createPoll(input: Omit<PollDefinition, "id" | "status">): PollDefinition {
    assertText(input.question, "question");
    if (input.options.length < 2 || input.options.some((option) => !option.label.trim())) {
      throw new Error("A poll requires at least two labeled options");
    }
    const poll: PollDefinition = { ...structuredClone(input), id: id("poll"), status: "open" };
    polls.set(poll.id, poll);
    votes.set(poll.id, new Map());
    return structuredClone(poll);
  }

  function vote(input: PollVote): boolean {
    const poll = polls.get(input.pollId);
    if (!poll || poll.status !== "open" || idempotency.has(input.idempotencyKey)) return false;
    const uniqueOptions = [...new Set(input.optionIds)];
    if (!poll.allowMultiple && uniqueOptions.length !== 1) return false;
    if (!uniqueOptions.length || uniqueOptions.some((optionId) => !poll.options.some((option) => option.id === optionId))) return false;
    const pollVotes = votes.get(poll.id)!;
    if (pollVotes.has(input.userId)) return false;
    pollVotes.set(input.userId, new Set(uniqueOptions));
    idempotency.add(input.idempotencyKey);
    return true;
  }

  return {
    config: immutableConfig,
    publish,
    events: (afterCursor = 0) => eventLog.slice(Math.max(0, afterCursor)).map((event) => structuredClone(event)),
    createPoll,
    vote,
    closePoll: (pollId) => {
      const poll = polls.get(pollId);
      if (!poll || poll.status !== "open") return false;
      poll.status = "closed";
      return true;
    },
    pollResults: (pollId) => {
      const poll = polls.get(pollId);
      if (!poll) return Object.freeze({});
      const result = Object.fromEntries(poll.options.map((option) => [option.id, 0]));
      for (const optionIds of votes.get(pollId)?.values() ?? []) for (const optionId of optionIds) result[optionId]++;
      return Object.freeze(result);
    },
    checkpoint: (input) => {
      const checkpoint: SessionCheckpoint = {
        ...structuredClone(input), checkpointId: id("checkpoint"), createdAt: new Date().toISOString(),
      };
      checkpoints.set(checkpoint.actorId, checkpoint);
      return structuredClone(checkpoint);
    },
  };
}

export const VERTICAL_BLUEPRINTS: Record<VerticalId, readonly CapabilityId[]> = {
  edu: ["chat", "presence", "video", "whiteboard", "poll", "attendance"],
  health: ["chat", "presence", "video", "clinical-data"],
  event: ["chat", "presence", "video", "poll", "ticket", "spatial"],
  finance: ["chat", "presence", "market-data"],
  continuity: ["chat", "presence", "spatial", "device-shadow"],
};
