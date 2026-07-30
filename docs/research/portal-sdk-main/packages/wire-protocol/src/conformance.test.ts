import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  isKnownChannelFrame,
  isKnownInboxFrame,
  parseChannelFrame,
  parseInboxFrame,
  type MemberRow,
  type ParsedChannelFrame,
  type ParsedInboxFrame,
} from "./index.js";

/**
 * Conformance against real frames captured from the platform's own gate harness.
 *
 * The recorded frames are NOT committed — they live only in the private test fixture at
 * `working-context/m3-frames.json`. This suite runs when that fixture is present (local dev,
 * and CI after the private-fixture fetch step) and skips visibly when it is not (fork PRs,
 * fresh clones). A frame that fails to parse here is a finding to raise, not a type to loosen.
 */

const fixturePath = fileURLToPath(
  new URL("../../../working-context/m3-frames.json", import.meta.url),
);
const present = existsSync(fixturePath);

if (!present) {
  console.warn(
    "[conformance] recorded fixture not found at working-context/m3-frames.json — " +
      "skipping recorded-frame conformance (expected on fork PRs / fresh clones; CI fetches it).",
  );
}

type Fixtures = {
  channel_ready: unknown;
  channel_frames_alice: unknown[];
  channel_presence_join: unknown;
  channel_presence_leave: unknown;
  inbox_ready: unknown;
  inbox_frames_alice: unknown[];
  roster: unknown[];
};

const label = (frame: unknown, i: number): string => {
  const t = (frame as { t?: unknown })?.t;
  const mode = (frame as { mode?: unknown })?.mode;
  return `[${i}] ${String(t)}${typeof mode === "string" ? `:${mode}` : ""}`;
};

const suite = present ? describe : describe.skip;

suite("conformance (recorded fixture)", () => {
  if (!present) {
    it.skip("requires the private fixture working-context/m3-frames.json", () => {});
    return;
  }

  const fixtures = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixtures;
  const channelFrames: unknown[] = [
    fixtures.channel_ready,
    ...fixtures.channel_frames_alice,
    fixtures.channel_presence_join,
    fixtures.channel_presence_leave,
  ];
  const inboxFrames: unknown[] = [fixtures.inbox_ready, ...fixtures.inbox_frames_alice];

  it.each(channelFrames.map((f, i) => [label(f, i), f] as const))(
    "%s parses into a known channel frame",
    (_name, frame) => {
      const parsed = parseChannelFrame(JSON.stringify(frame));
      expect(parsed).not.toBeNull();
      expect(isKnownChannelFrame(parsed as ParsedChannelFrame)).toBe(true);
    },
  );

  it.each(inboxFrames.map((f, i) => [label(f, i), f] as const))(
    "%s parses into a known inbox frame",
    (_name, frame) => {
      const parsed = parseInboxFrame(JSON.stringify(frame));
      expect(parsed).not.toBeNull();
      expect(isKnownInboxFrame(parsed as ParsedInboxFrame)).toBe(true);
    },
  );

  it("parses every frame without losing a byte", () => {
    for (const frame of channelFrames) {
      expect(parseChannelFrame(JSON.stringify(frame))).toStrictEqual(frame);
    }
    for (const frame of inboxFrames) {
      expect(parseInboxFrame(JSON.stringify(frame))).toStrictEqual(frame);
    }
  });

  it("carries a real presence leave — a delta with a non-empty string[] left", () => {
    const leaves = channelFrames.filter((f) => {
      const frame = f as { t?: unknown; left?: unknown };
      return (
        frame.t === "presence" &&
        Array.isArray(frame.left) &&
        frame.left.length > 0 &&
        frame.left.every((id) => typeof id === "string")
      );
    });
    expect(leaves.length).toBeGreaterThan(0);
  });

  it("roster is a §3.3 member directory, not a frame", () => {
    expect(parseChannelFrame(JSON.stringify(fixtures.roster))).toBeNull();
    for (const row of fixtures.roster as MemberRow[]) {
      expect(typeof row.userId).toBe("string");
      expect(typeof row.online).toBe("boolean");
      expect(typeof row.claims).toBe("object");
    }
  });
});
