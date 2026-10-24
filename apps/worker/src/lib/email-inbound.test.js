import { describe, expect, it, vi, afterEach } from "vitest";
import {
  composeInboundText,
  handleEmailInbound,
  normalizeEmailAddress,
  parseLocalPartRoute,
  parseRawEmail,
} from "./email-inbound.js";

describe("email inbound parse", () => {
  it("extracts addresses and body from raw MIME", () => {
    const parsed = parseRawEmail(
      "From: Ada <ada@ex.com>\nTo: room-ops@inbound.fluxychat.com\nSubject: Outage\nMessage-ID: <abc@ex.com>\n\nThe site is down.",
    );
    expect(parsed.from).toBe("ada@ex.com");
    expect(parsed.to).toBe("room-ops@inbound.fluxychat.com");
    expect(parsed.subject).toBe("Outage");
    expect(parsed.messageId).toBe("abc@ex.com");
    expect(parsed.body).toContain("The site is down.");
  });

  it("maps room- and agent- local parts", () => {
    expect(parseLocalPartRoute("room-support")).toEqual({ roomId: "support", agentId: null, mode: "room" });
    expect(parseLocalPartRoute("agent-bot1")).toEqual({ roomId: null, agentId: "bot1", mode: "agent" });
    expect(normalizeEmailAddress("Name <A@B.COM>")).toBe("a@b.com");
  });

  it("composes a room message from subject and body", () => {
    const text = composeInboundText({ from: "a@b.com", subject: "Hi", body: "There" });
    expect(text).toContain("Subject: Hi");
    expect(text).toContain("There");
  });
});

describe("handleEmailInbound", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("inserts into the mapped room and is idempotent on Message-ID", async () => {
    const env = createEmailEnv();
    const first = await handleEmailInbound(env, {
      projectId: "proj_1",
      raw: "From: a@b.com\nTo: room-ops@inbound.test\nMessage-ID: <id-1@x>\n\nHello room",
    });
    expect(first.ok).toBe(true);
    expect(first.roomId).toBe("ops");
    expect(env._messages).toHaveLength(1);
    expect(env._messages[0].kind || "email").toBeTruthy();

    const dup = await handleEmailInbound(env, {
      projectId: "proj_1",
      raw: "From: a@b.com\nTo: room-ops@inbound.test\nMessage-ID: <id-1@x>\n\nHello room",
    });
    expect(dup.duplicate).toBe(true);
    expect(env._messages).toHaveLength(1);
  });

  it("bounces when the destination has no route", async () => {
    const env = createEmailEnv();
    const result = await handleEmailInbound(env, {
      projectId: "proj_1",
      from: "a@b.com",
      to: "nobody@inbound.test",
      text: "hi",
      messageId: "m2",
    });
    expect(result.ok).toBe(false);
    expect(result.reject).toBe("no mailbox");
  });

  it("rejects a local-part room that is not in this project (audit F-80)", async () => {
    const env = createEmailEnv();
    const result = await handleEmailInbound(env, {
      projectId: "proj_1",
      from: "a@b.com",
      to: "room-other-tenant-room@inbound.test",
      text: "hi",
      messageId: "m3",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("room_not_found");
    expect(env._messages).toHaveLength(0);
  });

  it("rejects a local-part agent that is not in this project (audit F-80)", async () => {
    const env = createEmailEnv();
    const result = await handleEmailInbound(env, {
      projectId: "proj_1",
      from: "a@b.com",
      to: "agent-other-tenant-bot@inbound.test",
      text: "hi",
      messageId: "m4",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("agent_not_found");
  });
});

function createEmailEnv(overrides = {}) {
  const messages = [];
  const events = [];
  const routes = [];
  const rooms = overrides.rooms ?? [{ id: "ops", project_id: "proj_1" }];
  const bots = overrides.bots ?? [];
  return {
    _messages: messages,
    ROOM: {
      idFromName: () => ({}),
      get: () => ({ fetch: async () => new Response(null, { status: 202 }) }),
    },
    AGENT: {
      idFromName: (n) => n,
      get: () => ({
        fetch: async () => new Response(JSON.stringify({ ok: true })),
      }),
    },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM email_inbound_events")) {
                  return events.find((e) => e.project_id === args[0] && e.message_id_hdr === args[1]) || null;
                }
                if (sql.includes("FROM email_inbound_routes")) {
                  return routes.find((r) => r.project_id === args[0] && (r.address === args[1] || r.address === args[2])) || null;
                }
                if (sql.includes("FROM rooms WHERE id = ? AND project_id = ?")) {
                  return rooms.find((r) => r.id === args[0] && r.project_id === args[1]) || null;
                }
                if (sql.includes("FROM bots WHERE id = ? AND project_id = ?")) {
                  return bots.find((b) => b.id === args[0] && b.project_id === args[1]) || null;
                }
                return null;
              },
              async all() {
                return { results: routes };
              },
              async run() {
                if (sql.includes("INSERT INTO messages")) {
                  messages.push({
                    project_id: args[0],
                    room_id: args[1],
                    user_id: args[2],
                    content: args[3],
                    kind: "email",
                  });
                  return { meta: { last_row_id: messages.length, changes: 1 } };
                }
                if (sql.includes("INSERT INTO email_inbound_events")) {
                  events.push({
                    project_id: args[1],
                    message_id_hdr: args[2],
                    fluxy_message_id: args[7],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
  };
}
