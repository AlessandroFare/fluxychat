import { describe, expect, it } from "vitest";

import {
  isBatch,
  isChannelReady,
  isInboxReady,
  isKnownChannelClientFrame,
  isKnownChannelFrame,
  isKnownInboxClientFrame,
  isKnownInboxFrame,
  isRefusalCode,
  parseChannelClientFrame,
  parseChannelFrame,
  parseInboxClientFrame,
  parseInboxFrame,
  serializeFrame,
  type ChannelClientFrame,
  type ChannelServerFrame,
  type InboxClientFrame,
  type InboxServerFrame,
  type WireMessage,
} from "./index.js";

const msg: WireMessage = {
  id: "m_1",
  seq: 4813,
  type: "message",
  kind: "text",
  content: { text: "hi" },
  sender: { id: "u_1", anon: false },
  timestamp: 1751980000000,
  retracted: false,
  ephemeral: false,
};

const channelFrames: Record<string, ChannelServerFrame> = {
  ready: {
    t: "ready",
    channel: { id: "room-7", mode: "standard" },
    me: { id: "u_1", anon: false, claims: {}, capabilities: { publish: true } },
    seq: 4812,
    leaf: "leaf_0",
    presence: {
      mode: "detailed",
      participants: [{ id: "u_1", anon: false, username: "ada" }],
      count: 1,
    },
    watermark: 4790,
    ext: { ns: {} },
    bindings: { "ns.": "ws" },
  },
  batch: { t: "batch", msgs: [msg] },
  retract: { t: "retract", id: "m_9f", seq: 4813, reason: "unsafe link" },
  "presence:detailed": {
    t: "presence",
    mode: "detailed",
    joined: [{ id: "u_2", anon: false }],
    left: ["u_3"],
    count: 214,
  },
  "presence:aggregate": { t: "presence", mode: "aggregate", count: 9412, recent: [] },
  activity: { t: "activity", userId: "u_2", kind: "typing", since: 1751980000000 },
  direct: { t: "direct", msg },
  reassign: { t: "reassign", leaf: "leaf_1" },
  error: { t: "error", code: "not_permitted", reason: "nope", ref: "cl_123" },
  pong: { t: "pong" },
};

const inboxFrames: Record<string, InboxServerFrame> = {
  ready: {
    t: "ready",
    entries: [{ id: "room-7", unread: 2, muted: false, at: 1751980000000 }],
    items: [{ id: "evt_1", type: "mention", data: { x: 1 }, at: 1751980000000, read: false }],
    counter: 7,
  },
  entry: {
    t: "entry",
    entry: {
      id: "room-7",
      latest: { text: "hi", sender: { id: "u_1" }, at: 1751980000000 },
      unread: 1,
      muted: false,
      at: 1751980000000,
    },
  },
  item: {
    t: "item",
    item: { id: "evt_2", type: "ticket.assigned", data: null, channelId: "room-7", at: 1, read: true },
  },
  counter: { t: "counter", n: 8 },
  pong: { t: "pong" },
};

describe("round-trip: parse(serialize(frame)) === frame", () => {
  it.each(Object.entries(channelFrames))("channel %s", (_name, frame) => {
    const parsed = parseChannelFrame(serializeFrame(frame));
    expect(parsed).toStrictEqual(frame);
    expect(parsed !== null && isKnownChannelFrame(parsed)).toBe(true);
  });

  it.each(Object.entries(inboxFrames))("inbox %s", (_name, frame) => {
    const parsed = parseInboxFrame(serializeFrame(frame));
    expect(parsed).toStrictEqual(frame);
    expect(parsed !== null && isKnownInboxFrame(parsed)).toBe(true);
  });
});

describe("garbage in → null, never a throw", () => {
  const garbage = [
    "",
    "{",
    "not json",
    "null",
    "undefined",
    "[]",
    "[1,2]",
    "123",
    '"a string"',
    "true",
    "{}", // no discriminator
    '{"t":1}', // t not a string
    '{"t":null}',
    '{"tt":"batch"}',
  ];

  it.each(garbage)("parseChannelFrame(%j)", (raw) => {
    expect(() => parseChannelFrame(raw)).not.toThrow();
    expect(parseChannelFrame(raw)).toBeNull();
  });

  it.each(garbage)("parseInboxFrame(%j)", (raw) => {
    expect(() => parseInboxFrame(raw)).not.toThrow();
    expect(parseInboxFrame(raw)).toBeNull();
  });
});

describe("known `t` with a broken shape → null", () => {
  // A frame that would have to lie about its type is refused rather than returned.
  const malformed = [
    '{"t":"batch"}', // msgs missing
    '{"t":"batch","msgs":"nope"}',
    '{"t":"batch","msgs":[{"id":"m_1"}]}', // msg missing required fields
    '{"t":"retract","id":"m_1"}', // seq missing
    '{"t":"retract","id":"m_1","seq":"4813"}', // seq wrong type
    '{"t":"activity","kind":"typing"}', // S→C activity needs userId + since
    '{"t":"direct"}',
    '{"t":"reassign"}',
    '{"t":"error"}', // code missing
    '{"t":"presence","mode":"detailed","count":1}', // joined/left missing
    '{"t":"presence","mode":"sideways","count":1}', // unknown mode
    '{"t":"ready","channel":{"id":"r","mode":"standard"}}', // me/seq/leaf/presence missing
    '{"t":"ready","channel":{"id":"r","mode":"elsewhere"},"me":{"id":"u","anon":false,"claims":{},"capabilities":{}},"seq":1,"leaf":"l","presence":{"mode":"detailed","participants":[],"count":0}}',
  ];

  it.each(malformed)("parseChannelFrame(%j)", (raw) => {
    expect(parseChannelFrame(raw)).toBeNull();
  });

  it("rejects a NaN seq that JSON could never carry", () => {
    expect(parseChannelFrame(JSON.stringify({ t: "retract", id: "m", seq: NaN }))).toBeNull();
  });
});

describe("unknown `t` → typed passthrough, not a drop (§6)", () => {
  it("returns the frame intact", () => {
    const raw = '{"t":"portal.future","payload":{"deep":[1,2]},"n":3}';
    const parsed = parseChannelFrame(raw);

    expect(parsed).not.toBeNull();
    expect(parsed).toStrictEqual({ t: "portal.future", payload: { deep: [1, 2] }, n: 3 });
  });

  it("is reported as unknown by the known-frame guard", () => {
    const parsed = parseChannelFrame('{"t":"portal.future"}');
    expect(parsed !== null && isKnownChannelFrame(parsed)).toBe(false);
  });

  it("survives a round-trip byte-for-byte", () => {
    const raw = '{"t":"portal.future","payload":{"deep":[1,2]},"n":3}';
    const parsed = parseChannelFrame(raw);

    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });

  it("treats an unknown inbox `t` the same way", () => {
    const parsed = parseInboxFrame('{"t":"inbox.future","x":1}');
    expect(parsed).toStrictEqual({ t: "inbox.future", x: 1 });
    expect(parsed !== null && isKnownInboxFrame(parsed)).toBe(false);
  });
});

describe("unknown fields on known frames survive (§6 additive evolution)", () => {
  it("preserves a field this version has never heard of", () => {
    const raw = '{"t":"counter","n":8,"caps":["x"],"futureField":{"a":1}}';
    const parsed = parseInboxFrame(raw);

    expect(parsed).toStrictEqual({ t: "counter", n: 8, caps: ["x"], futureField: { a: 1 } });
    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });

  it("preserves unknown fields nested inside a WireMessage", () => {
    const raw = JSON.stringify({ t: "batch", msgs: [{ ...msg, futureField: "kept" }] });
    const parsed = parseChannelFrame(raw);

    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });

  it("preserves an unrecognised capability on `ready` rather than dropping the frame", () => {
    const raw = JSON.stringify({
      ...channelFrames["ready"],
      me: {
        id: "u_1",
        anon: false,
        claims: {},
        capabilities: { publish: true, futureCap: "tier-2" },
      },
    });
    const parsed = parseChannelFrame(raw);

    expect(parsed).not.toBeNull();
    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });
});

describe("the two socket families are disjoint", () => {
  it("does not accept an inbox `ready` on the channel parser", () => {
    expect(parseChannelFrame(serializeFrame(inboxFrames["ready"]!))).toBeNull();
  });

  it("does not accept a channel `ready` on the inbox parser", () => {
    expect(parseInboxFrame(serializeFrame(channelFrames["ready"]!))).toBeNull();
  });
});

describe("guards narrow parsed frames", () => {
  it("isChannelReady / isBatch pick out their own frame", () => {
    const ready = parseChannelFrame(serializeFrame(channelFrames["ready"]!));
    const batch = parseChannelFrame(serializeFrame(channelFrames["batch"]!));

    expect(ready !== null && isChannelReady(ready)).toBe(true);
    expect(ready !== null && isBatch(ready)).toBe(false);
    expect(batch !== null && isBatch(batch)).toBe(true);
  });

  it("isInboxReady picks out the inbox ready", () => {
    const parsed = parseInboxFrame(serializeFrame(inboxFrames["ready"]!));
    expect(parsed !== null && isInboxReady(parsed)).toBe(true);
  });
});

describe("C→S channel frames — serialize + parse round-trip (§2.2)", () => {
  // `meta` is the frame added in 0.1.0; the C→S parsers arrive in 0.2.0 for servers and
  // the test mock receiving upstream frames.
  const upstream: Record<string, ChannelClientFrame> = {
    ephemeral: { t: "ephemeral", cl: "cl_9", type: "cursor.move", content: { x: 1 } },
    activity: { t: "activity", kind: "typing" },
    watermark: { t: "watermark", seq: 4810 },
    meta: { t: "meta", metadata: { color: "blue", away: false } },
    ping: { t: "ping" },
  };

  it.each(Object.entries(upstream))(
    "%s round-trips through parseChannelClientFrame",
    (_name, frame) => {
      const parsed = parseChannelClientFrame(serializeFrame(frame));
      expect(parsed).toStrictEqual(frame);
      expect(parsed !== null && isKnownChannelClientFrame(parsed)).toBe(true);
    },
  );

  it("serializes a meta frame to the pinned shape", () => {
    expect(serializeFrame({ t: "meta", metadata: { role: "host" } })).toBe(
      '{"t":"meta","metadata":{"role":"host"}}',
    );
  });
});

describe("C→S inbox frames — serialize + parse round-trip (§5)", () => {
  const upstream: Record<string, InboxClientFrame> = {
    read: { t: "read", channelId: "room-7" },
    "item.read": { t: "item.read", id: "evt_1" },
    "read.all": { t: "read.all" },
    mute: { t: "mute", channelId: "room-7", muted: true },
    ping: { t: "ping" },
  };

  it.each(Object.entries(upstream))(
    "%s round-trips through parseInboxClientFrame",
    (_name, frame) => {
      const parsed = parseInboxClientFrame(serializeFrame(frame));
      expect(parsed).toStrictEqual(frame);
      expect(parsed !== null && isKnownInboxClientFrame(parsed)).toBe(true);
    },
  );
});

describe("C→S parsers are total (same contract as S→C)", () => {
  const garbage = ["", "{", "not json", "null", "[]", "123", "{}", '{"t":1}'];

  it.each(garbage)("parseChannelClientFrame(%j) → null, no throw", (raw) => {
    expect(() => parseChannelClientFrame(raw)).not.toThrow();
    expect(parseChannelClientFrame(raw)).toBeNull();
  });

  it.each(garbage)("parseInboxClientFrame(%j) → null, no throw", (raw) => {
    expect(parseInboxClientFrame(raw)).toBeNull();
  });

  // Each malformed frame must be parsed by its OWN family's parser — the other family
  // would treat the `t` as unknown and pass it through, which is correct but not the
  // shape check under test.
  const malformedChannel = [
    '{"t":"ephemeral","cl":"c"}', // type + content missing
    '{"t":"watermark","seq":"4810"}', // seq wrong type
    '{"t":"meta"}', // metadata missing
  ];
  const malformedInbox = [
    '{"t":"mute","channelId":"r"}', // muted missing
    '{"t":"item.read"}', // id missing
    '{"t":"read","channelId":5}', // channelId wrong type
  ];

  it.each(malformedChannel)("known channel C→S `t` with bad shape → null (%j)", (raw) => {
    expect(parseChannelClientFrame(raw)).toBeNull();
  });

  it.each(malformedInbox)("known inbox C→S `t` with bad shape → null (%j)", (raw) => {
    expect(parseInboxClientFrame(raw)).toBeNull();
  });

  it("unknown C→S `t` → UnknownFrame passthrough, not a drop (§6)", () => {
    const raw = '{"t":"future.up","x":[1,2]}';
    const parsed = parseChannelClientFrame(raw);
    expect(parsed).toStrictEqual({ t: "future.up", x: [1, 2] });
    expect(parsed !== null && isKnownChannelClientFrame(parsed)).toBe(false);
    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });

  it("preserves unknown fields on a known C→S frame (§6)", () => {
    const raw = '{"t":"meta","metadata":{"a":1},"futureField":true}';
    const parsed = parseChannelClientFrame(raw);
    expect(parsed).toStrictEqual({ t: "meta", metadata: { a: 1 }, futureField: true });
    expect(parsed !== null && serializeFrame(parsed)).toBe(raw);
  });
});

describe("isRefusalCode (§1.1)", () => {
  it("accepts every documented code", () => {
    for (const code of [
      "invalid_token",
      "token_expired",
      "invalid_api_key",
      "not_member",
      "banned",
      "anonymous_not_allowed",
      "unknown_channel",
      "unsupported_version",
      "channel_at_capacity",
    ]) {
      expect(isRefusalCode(code)).toBe(true);
    }
  });

  it.each([undefined, null, 401, "", "nope", "INVALID_TOKEN", {}])(
    "rejects %j",
    (value) => {
      expect(isRefusalCode(value)).toBe(false);
    },
  );
});
