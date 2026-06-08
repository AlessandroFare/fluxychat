import { describe, expect, it, vi, afterEach } from "vitest";
import { parseInboundPayload, handleTelcoInboundMessage } from "./telco-inbound.js";

describe("parseInboundPayload", () => {
  it("detects inbound SMS body", () => {
    const parsed = parseInboundPayload({
      type: "message.received",
      data: {
        direction: "inbound",
        from_e164: "+14155551234",
        body: "Yes, call me back",
        id: "msg-in-1",
        channel: "sms",
      },
    });
    expect(parsed?.fromE164).toBe("+14155551234");
    expect(parsed?.text).toBe("Yes, call me back");
    expect(parsed?.channel).toBe("sms");
  });

  it("maps whatsapp channel", () => {
    const parsed = parseInboundPayload({
      type: "message.received",
      data: {
        from: "+39333111222",
        text: "Ciao",
        channel: "whatsapp",
      },
    });
    expect(parsed?.channel).toBe("whatsapp");
  });
});

describe("handleTelcoInboundMessage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("skips when disabled", async () => {
    const result = await handleTelcoInboundMessage({ TELCO_INBOUND_ENABLED: "false", DB: {} }, {});
    expect(result.skipped).toBe(true);
  });

  it("inserts message and fanouts when enabled", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 202 }));
    const env = createTelcoEnv();
    const result = await handleTelcoInboundMessage(env, {
      type: "message.received",
      data: {
        direction: "inbound",
        from_e164: "+14155551234",
        body: "Reply from phone",
        id: "ext-99",
        project_id: "proj_1",
      },
    });
    expect(result.ok).toBe(true);
    expect(result.messageId).toBe(1);
    expect(result.roomId).toBe("room_dm");
    expect(env._messages).toHaveLength(1);
    expect(env._inboundEvents).toHaveLength(1);
  });

  it("deduplicates by external id", async () => {
    const env = createTelcoEnv();
    env._inboundEvents.push({
      project_id: "proj_1",
      external_id: "ext-dup",
      message_id: 5,
    });
    const result = await handleTelcoInboundMessage(env, {
      type: "message.received",
      data: {
        direction: "inbound",
        from_e164: "+14155551234",
        body: "dup",
        id: "ext-dup",
        project_id: "proj_1",
      },
    });
    expect(result.duplicate).toBe(true);
    expect(result.messageId).toBe(5);
  });
});

function createTelcoEnv() {
  const messages = [];
  const inboundEvents = [];
  return {
    TELCO_INBOUND_ENABLED: "true",
    _messages: messages,
    _inboundEvents: inboundEvents,
    ROOM: {
      idFromName: () => ({ toString: () => "do-id" }),
      get: () => ({
        fetch: async () => new Response(null, { status: 202 }),
      }),
    },
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM telco_inbound_events")) {
                  return inboundEvents.find(
                    (e) => e.project_id === args[0] && e.external_id === args[1],
                  );
                }
                if (sql.includes("FROM sent_dm_contacts")) {
                  return { user_id: "user_1" };
                }
                if (sql.includes("FROM sent_dm_deliveries")) {
                  return { room_id: "room_dm" };
                }
                if (sql.includes("FROM rooms WHERE project_id")) {
                  return { id: args[1] };
                }
                return null;
              },
              async run() {
                if (sql.includes("INSERT INTO messages")) {
                  messages.push({
                    id: messages.length + 1,
                    project_id: args[0],
                    room_id: args[1],
                    user_id: args[2],
                    content: args[3],
                  });
                  return { meta: { last_row_id: messages.length, changes: 1 } };
                }
                if (sql.includes("INSERT INTO telco_inbound_events")) {
                  inboundEvents.push({
                    project_id: args[1],
                    external_id: args[2],
                    message_id: args[7],
                  });
                }
                return { meta: { changes: 1, last_row_id: messages.length } };
              },
            };
          },
        };
      },
    },
  };
}
