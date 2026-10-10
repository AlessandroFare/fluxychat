import { occupancyFromLive } from "./occupancy";
import { FLUXY_SDK_VERSION } from "./version";

export type FluxyRoomCliCommand =
  | { kind: "help" }
  | { kind: "error"; message: string }
  | { kind: "health"; worker: string; token: string }
  | {
      kind: "send";
      worker: string;
      token: string;
      room: string;
      text: string;
      userId: string;
      metadata?: Record<string, unknown>;
      headers?: Record<string, string>;
      replyTo?: number;
    }
  | { kind: "tail"; worker: string; token: string; room: string; userId: string }
  | { kind: "occupancy"; worker: string; token: string; room: string }
  | { kind: "history"; worker: string; token: string; room: string; limit: number; before: string }
  | { kind: "presence"; worker: string; token: string; room: string }
  | {
      kind: "update";
      worker: string;
      token: string;
      room: string;
      messageId: number;
      text: string;
      description?: string;
      metadata?: Record<string, unknown>;
      headers?: Record<string, string>;
    }
  | {
      kind: "delete";
      worker: string;
      token: string;
      room: string;
      messageId: number;
      description?: string;
    }
  | { kind: "exists"; worker: string; token: string; room: string }
  | { kind: "get"; worker: string; token: string; room: string; messageId: number }
  | { kind: "react"; worker: string; token: string; room: string; messageId: number; emoji: string }
  | { kind: "unreact"; worker: string; token: string; room: string; messageId: number; emoji: string }
  | { kind: "reactions"; worker: string; token: string; room: string; messageId: number }
  | { kind: "versions"; worker: string; token: string; room: string; messageId: number }
  | { kind: "version" };

function parseJsonObject(
  raw: string,
  flag: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: `${flag} must be a JSON object.` };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: `${flag} must be valid JSON.` };
  }
}

function argValue(argv: string[], name: string): string {
  const idx = argv.indexOf(name);
  if (idx === -1 || idx === argv.length - 1) return "";
  return String(argv[idx + 1] || "").trim();
}

function env(name: string): string {
  if (typeof process === "undefined") return "";
  return String(process.env[name] || "").trim();
}

export function fluxyRoomVersion(): string {
  return FLUXY_SDK_VERSION;
}

export function fluxyRoomCliHelp(): string {
  return `fluxy-room — operator tail / send / health against a Worker JWT.

Usage:
  fluxy-room health --worker <url>
  fluxy-room send --worker <url> --token <jwt> --room <id> --text <message> [--metadata <json>] [--headers <json>] [--reply-to <id>]
  fluxy-room update --worker <url> --token <jwt> --room <id> --id <messageId> --text <message> [--description <text>] [--metadata <json>] [--headers <json>]
  fluxy-room delete --worker <url> --token <jwt> --room <id> --id <messageId> [--description <text>]
  fluxy-room get --worker <url> --token <jwt> --room <id> --id <messageId>
  fluxy-room react --worker <url> --token <jwt> --room <id> --id <messageId> --emoji <name>
  fluxy-room unreact --worker <url> --token <jwt> --room <id> --id <messageId> --emoji <name>
  fluxy-room reactions --worker <url> --token <jwt> --room <id> --id <messageId>
  fluxy-room versions --worker <url> --token <jwt> --room <id> --id <messageId>
  fluxy-room history --worker <url> --token <jwt> --room <id> [--limit <n>] [--before <iso>]
  fluxy-room presence --worker <url> --token <jwt> --room <id>
  fluxy-room tail --worker <url> --token <jwt> --room <id> [--user <userId>]
  fluxy-room occupancy --worker <url> --token <jwt> --room <id>
  fluxy-room exists --worker <url> --token <jwt> --room <id>
  fluxy-room version

Env fallbacks: FLUXY_WORKER_URL, FLUXY_MEMBER_JWT, FLUXY_ROOM_ID, FLUXY_USER_ID.
Not a Control API. Hosted is beta.
`;
}

export function parseFluxyRoomArgs(argv: string[]): FluxyRoomCliCommand {
  const cmd = argv[0];
  if (!cmd || cmd === "-h" || cmd === "--help" || cmd === "help") return { kind: "help" };

  const worker = argValue(argv, "--worker") || env("FLUXY_WORKER_URL");
  const token = argValue(argv, "--token") || env("FLUXY_MEMBER_JWT");
  const room = argValue(argv, "--room") || env("FLUXY_ROOM_ID");
  const userId = argValue(argv, "--user") || env("FLUXY_USER_ID") || "cli";
  const text = argValue(argv, "--text");

  if (cmd === "health") {
    if (!worker) return { kind: "error", message: "health needs --worker (or FLUXY_WORKER_URL)." };
    return { kind: "health", worker, token };
  }
  if (cmd === "send") {
    if (!worker || !token || !room || !text) {
      return { kind: "error", message: "send needs --worker --token --room --text." };
    }
    const metadataRaw = argValue(argv, "--metadata");
    const headersRaw = argValue(argv, "--headers");
    let metadata: Record<string, unknown> | undefined;
    let headers: Record<string, string> | undefined;
    if (metadataRaw) {
      const parsed = parseJsonObject(metadataRaw, "--metadata");
      if (!parsed.ok) return { kind: "error", message: parsed.error };
      metadata = parsed.value;
    }
    if (headersRaw) {
      const parsed = parseJsonObject(headersRaw, "--headers");
      if (!parsed.ok) return { kind: "error", message: parsed.error };
      headers = Object.fromEntries(
        Object.entries(parsed.value).map(([key, value]) => [key, String(value)]),
      );
    }
    const replyRaw = argValue(argv, "--reply-to");
    const replyTo = replyRaw ? Number(replyRaw) : NaN;
    return {
      kind: "send",
      worker,
      token,
      room,
      text,
      userId,
      metadata,
      headers,
      ...(Number.isFinite(replyTo) && replyTo > 0 ? { replyTo } : {}),
    };
  }
  if (cmd === "history") {
    if (!worker || !token || !room) {
      return { kind: "error", message: "history needs --worker --token --room." };
    }
    const limitRaw = Number(argValue(argv, "--limit") || "50");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 200) : 50;
    return { kind: "history", worker, token, room, limit, before: argValue(argv, "--before") };
  }
  if (cmd === "presence") {
    if (!worker || !token || !room) {
      return { kind: "error", message: "presence needs --worker --token --room." };
    }
    return { kind: "presence", worker, token, room };
  }
  if (cmd === "tail") {
    if (!worker || !token || !room) {
      return { kind: "error", message: "tail needs --worker --token --room." };
    }
    return { kind: "tail", worker, token, room, userId };
  }
  if (cmd === "occupancy") {
    if (!worker || !token || !room) {
      return { kind: "error", message: "occupancy needs --worker --token --room." };
    }
    return { kind: "occupancy", worker, token, room };
  }
  if (cmd === "exists") {
    if (!worker || !token || !room) {
      return { kind: "error", message: "exists needs --worker --token --room." };
    }
    return { kind: "exists", worker, token, room };
  }
  if (cmd === "version") return { kind: "version" };
  if (cmd === "update") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    if (!worker || !token || !room || !text || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: "update needs --worker --token --room --id --text." };
    }
    const metadataRaw = argValue(argv, "--metadata");
    const headersRaw = argValue(argv, "--headers");
    let metadata: Record<string, unknown> | undefined;
    let headers: Record<string, string> | undefined;
    if (metadataRaw) {
      const parsed = parseJsonObject(metadataRaw, "--metadata");
      if (!parsed.ok) return { kind: "error", message: parsed.error };
      metadata = parsed.value;
    }
    if (headersRaw) {
      const parsed = parseJsonObject(headersRaw, "--headers");
      if (!parsed.ok) return { kind: "error", message: parsed.error };
      headers = Object.fromEntries(
        Object.entries(parsed.value).map(([key, value]) => [key, String(value)]),
      );
    }
    const description = argValue(argv, "--description") || undefined;
    return {
      kind: "update",
      worker,
      token,
      room,
      messageId: Math.floor(messageId),
      text,
      ...(description ? { description } : {}),
      metadata,
      headers,
    };
  }
  if (cmd === "delete") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    if (!worker || !token || !room || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: "delete needs --worker --token --room --id." };
    }
    const description = argValue(argv, "--description") || undefined;
    return {
      kind: "delete",
      worker,
      token,
      room,
      messageId: Math.floor(messageId),
      ...(description ? { description } : {}),
    };
  }
  if (cmd === "get") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    if (!worker || !token || !room || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: "get needs --worker --token --room --id." };
    }
    return { kind: "get", worker, token, room, messageId: Math.floor(messageId) };
  }
  if (cmd === "react" || cmd === "unreact") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    const emoji = argValue(argv, "--emoji") || argValue(argv, "--name");
    if (!worker || !token || !room || !emoji || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: `${cmd} needs --worker --token --room --id --emoji.` };
    }
    return { kind: cmd, worker, token, room, messageId: Math.floor(messageId), emoji };
  }
  if (cmd === "reactions") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    if (!worker || !token || !room || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: "reactions needs --worker --token --room --id." };
    }
    return { kind: "reactions", worker, token, room, messageId: Math.floor(messageId) };
  }
  if (cmd === "versions") {
    const messageId = Number(argValue(argv, "--id") || argValue(argv, "--serial"));
    if (!worker || !token || !room || !Number.isFinite(messageId) || messageId < 1) {
      return { kind: "error", message: "versions needs --worker --token --room --id." };
    }
    return { kind: "versions", worker, token, room, messageId: Math.floor(messageId) };
  }
  return { kind: "error", message: `unknown command "${cmd}". Try health, send, update, delete, get, react, unreact, reactions, versions, history, presence, tail, occupancy, exists, or version.` };
}

export function formatRoomEventLine(event: { type?: string } & Record<string, unknown>): string {
  const type = String(event.type || "event");
  if (type === "message") {
    return `[message] ${String(event.userId || "")}: ${String(event.content || "").slice(0, 200)}`;
  }
  if (type === "occupancy" || type === "occupancy.updated") {
    const nested =
      event.occupancy && typeof event.occupancy === "object"
        ? (event.occupancy as Record<string, unknown>)
        : event;
    const connections = nested.connections ?? event.connections;
    const members = nested.presenceMembers ?? event.presenceMembers;
    const watching =
      nested.watching ??
      event.watching ??
      (connections != null && members != null
        ? Math.max(0, Number(connections) - Number(members))
        : "");
    return `[occupancy] connections=${String(connections ?? "")} members=${String(members ?? "")} watching=${String(watching)}`;
  }
  if (type === "discontinuity") {
    return `[discontinuity] expected=${String(event.expectedSeq ?? "")} received=${String(event.receivedSeq ?? "")}`;
  }
  if (type === "typing" || type === "typing.set.changed") {
    const currently = Array.isArray(event.currentlyTyping)
      ? event.currentlyTyping
      : Array.isArray(event.userIds)
        ? event.userIds
        : [];
    return `[typing] ${currently.map(String).join(",")}`;
  }
  if (type === "reaction" || type === "room_reaction") {
    const name = String(event.emoji ?? event.name ?? "");
    const op = event.op ? ` ${String(event.op)}` : "";
    return `[reaction] ${String(event.userId || "")}${op} ${name}`.trim();
  }
  return `[${type}] ${JSON.stringify(event).slice(0, 240)}`;
}

export async function runHealth(worker: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const url = new URL("/health", worker.endsWith("/") ? worker : `${worker}/`);
  const res = await fetchImpl(url.toString());
  const body = await res.text();
  return `${res.status} ${body.slice(0, 400)}`;
}

function liveUrl(worker: string, room: string): string {
  const base = worker.endsWith("/") ? worker : `${worker}/`;
  return new URL(`rooms/${encodeURIComponent(room)}/live`, base).toString();
}

export async function runOccupancy(
  worker: string,
  token: string,
  room: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(liveUrl(worker, room), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`occupancy failed: ${res.status}`);
  const body = (await res.json()) as {
    subscriptionCount?: number;
    userCount?: number;
    members?: Array<{ userId: string }>;
    online?: number;
  };
  return JSON.stringify(occupancyFromLive(body));
}

export async function runHistory(
  worker: string,
  token: string,
  room: string,
  options: { limit: number; before?: string } = { limit: 50 },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const base = worker.endsWith("/") ? worker : `${worker}/`;
  const url = new URL("api/messages", base);
  url.searchParams.set("roomId", room);
  url.searchParams.set("limit", String(options.limit));
  if (options.before?.trim()) url.searchParams.set("before", options.before.trim());
  const res = await fetchImpl(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`history failed: ${res.status}`);
  const body = (await res.json()) as { messages?: unknown[] };
  return JSON.stringify(body.messages ?? []);
}

export async function runPresence(
  worker: string,
  token: string,
  room: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(liveUrl(worker, room), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`presence failed: ${res.status}`);
  const body = (await res.json()) as { members?: Array<{ userId?: string }> };
  const members = Array.isArray(body.members)
    ? body.members.map((row) => String(row.userId || "").trim()).filter(Boolean)
    : [];
  return JSON.stringify({ members });
}

export async function runExists(
  worker: string,
  token: string,
  room: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(liveUrl(worker, room), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return "false";
  if (!res.ok) throw new Error(`exists failed: ${res.status}`);
  return "true";
}

function messageUrl(worker: string, messageId: number): string {
  const base = worker.endsWith("/") ? worker : `${worker}/`;
  return new URL(`messages/${messageId}`, base).toString();
}

export async function runUpdate(
  worker: string,
  token: string,
  messageId: number,
  text: string,
  extras: {
    description?: string;
    metadata?: Record<string, unknown>;
    headers?: Record<string, string>;
  } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(messageUrl(worker, messageId), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: text,
      ...(extras.metadata ? { metadata: extras.metadata } : {}),
      ...(extras.headers ? { headers: extras.headers } : {}),
      ...(extras.description ? { description: extras.description } : {}),
    }),
  });
  if (!res.ok) throw new Error(`update failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

export async function runDelete(
  worker: string,
  token: string,
  messageId: number,
  extras: { description?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(messageUrl(worker, messageId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...(extras.description ? { description: extras.description } : {}),
    }),
  });
  if (!res.ok) throw new Error(`delete failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

function reactionsUrl(worker: string, messageId: number, suffix = ""): string {
  const base = worker.endsWith("/") ? worker : `${worker}/`;
  return new URL(`messages/${messageId}/reactions${suffix}`, base).toString();
}

export async function runGet(
  worker: string,
  token: string,
  messageId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(messageUrl(worker, messageId), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`get failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

export async function runReact(
  worker: string,
  token: string,
  messageId: number,
  emoji: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(reactionsUrl(worker, messageId), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: emoji, emoji }),
  });
  if (!res.ok) throw new Error(`react failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

export async function runUnreact(
  worker: string,
  token: string,
  messageId: number,
  emoji: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(reactionsUrl(worker, messageId), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: emoji, emoji }),
  });
  if (!res.ok) throw new Error(`unreact failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

export async function runReactionSummary(
  worker: string,
  token: string,
  messageId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(reactionsUrl(worker, messageId, "/summary"), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`reactions failed: ${res.status}`);
  return JSON.stringify(await res.json());
}

export async function runVersions(
  worker: string,
  token: string,
  messageId: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(messageUrl(worker, messageId) + "/versions", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`versions failed: ${res.status}`);
  const body = (await res.json()) as { items?: unknown[] };
  return JSON.stringify(body.items ?? body);
}
