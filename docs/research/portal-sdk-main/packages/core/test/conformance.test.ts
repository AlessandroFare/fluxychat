import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  isBatch,
  isChannelReady,
  isInboxCounter,
  isInboxEntry,
  isPresence,
  isRetract,
  type ChannelServerFrame,
  type InboxEntryWire,
  type InboxServerFrame,
  type WireMessage,
} from "@portalsdk/wire-protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import { Portal } from "../src/index.js";
import { resetHttpClientFactory, setHttpClientFactory } from "../src/http/factory.js";
import { resetSocketFactory, setSocketFactory } from "../src/transport/factory.js";
import { MockHttpClient } from "./mock-server/http.js";
import { MockSocketServer } from "./mock-server/index.js";

/**
 * End-to-end conformance: the client, fed the recorded server frames, reproduces the
 * recording's end state. The recorded frames are private (`working-context/m3-frames.json`);
 * this suite skips visibly when the fixture is absent. Expectations are DERIVED from the
 * fixture at runtime — no recorded value is hard-coded here — so this file discloses only
 * client behavior, never the recording.
 */

const fixturePath = fileURLToPath(
  new URL("../../../working-context/m3-frames.json", import.meta.url),
);
const present = existsSync(fixturePath);

if (!present) {
  console.warn(
    "[conformance] recorded fixture not found at working-context/m3-frames.json — " +
      "skipping end-to-end conformance (expected on fork PRs / fresh clones; CI fetches it).",
  );
}

type Fixtures = {
  channel_frames_alice: ChannelServerFrame[];
  inbox_frames_alice: InboxServerFrame[];
};

afterEach(() => {
  resetSocketFactory();
  resetHttpClientFactory();
  vi.useRealTimers();
});

const suite = present ? describe : describe.skip;

suite("conformance (recorded fixture)", () => {
  if (!present) {
    it.skip("requires the private fixture working-context/m3-frames.json", () => {});
    return;
  }

  const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixtures;

  it("channel: reproduces the recorded end state", async () => {
    const frames = fixtures.channel_frames_alice;
    const ready = frames.find(isChannelReady);
    const channelId = ready?.channel.id ?? "channel";

    const server = new MockSocketServer((ctx) => {
      ctx.open();
      for (const frame of frames) ctx.send(frame);
    });
    setSocketFactory(server.factory);
    setHttpClientFactory(new MockHttpClient().factory); // empty gap-fill / backfill
    const channel = new Portal({ apiKey: "pk", token: "jwt" }).channel(channelId);
    channel.acquire();
    await vi.waitFor(() => expect(channel.status).toBe("ready"));

    // Derive the expected window from the recorded frames themselves.
    const persistent: WireMessage[] = frames
      .filter(isBatch)
      .flatMap((f) => f.msgs)
      .filter((m) => m.seq !== null && !m.ephemeral);
    const retractedIds = new Set(frames.filter(isRetract).map((f) => f.id));
    const expectedIds = [...persistent]
      .sort((a, b) => (a.seq as number) - (b.seq as number))
      .map((m) => m.id);

    expect(channel.messages.map((m) => m.id)).toEqual(expectedIds);
    for (const message of channel.messages) {
      expect(message.retracted).toBe(retractedIds.has(message.id));
      if (message.retracted) expect(message.content).toBeNull();
    }

    const mentioned = persistent.find((m) => (m.mentions?.length ?? 0) > 0);
    if (mentioned !== undefined) {
      const got = channel.messages.find((m) => m.id === mentioned.id);
      expect(got?.mentions).toEqual(mentioned.mentions);
    }

    // Presence end state, folded from the recorded snapshot + detailed deltas.
    const roster = new Map<string, unknown>();
    let expectedCount = 0;
    if (ready?.presence.mode === "detailed") {
      for (const p of ready.presence.participants) roster.set(p.id, p);
      expectedCount = ready.presence.count;
    }
    for (const frame of frames.filter(isPresence)) {
      if (frame.mode !== "detailed") continue;
      for (const p of frame.joined) roster.set(p.id, p);
      for (const id of frame.left) roster.delete(id);
      expectedCount = frame.count;
    }
    expect(channel.presence?.kind).toBe("detailed");
    const presence = channel.presence as { participants: { id: string }[]; count: number };
    expect(presence.participants.map((p) => p.id)).toEqual([...roster.keys()]);
    expect(presence.count).toBe(expectedCount);
  });

  it("inbox: reproduces the recorded end state", async () => {
    const frames = fixtures.inbox_frames_alice;
    const server = new MockSocketServer((ctx) => {
      ctx.open();
      for (const frame of frames) ctx.send(frame);
    });
    setSocketFactory(server.factory);
    const inbox = new Portal({ apiKey: "pk", token: "jwt" }).inbox();
    await vi.waitFor(() => expect(inbox.status).toBe("ready"));

    const counters = frames.filter(isInboxCounter);
    expect(inbox.counter).toBe(counters.at(-1)?.n ?? 0);

    const lastEntry = new Map<string, InboxEntryWire>();
    for (const frame of frames.filter(isInboxEntry)) lastEntry.set(frame.entry.id, frame.entry);
    for (const [id, entry] of lastEntry) {
      const got = inbox.channels.get(id);
      expect(got?.unread).toBe(entry.unread);
      expect(got?.latest?.text).toBe(entry.latest?.text);
    }
  });
});
