import { PROTOCOL_VERSION } from "@portalsdk/wire-protocol";
import { describe, expect, it } from "vitest";

import {
  buildChannelUpgradeUrl,
  upgradeUrlToHttpProbe,
} from "../src/url.js";

describe("PROTOCOL_VERSION on the wire", () => {
  it("stringifies to \"1\" for the ?v= param", () => {
    // PROTOCOL_VERSION is the number 1; the upgrade carries it as the string "1".
    expect(String(PROTOCOL_VERSION)).toBe("1");
  });

  it("is written to ?v= as its string form", () => {
    const url = new URL(
      buildChannelUpgradeUrl({
        realtimeUrl: "wss://realtime.useportal.co",
        channelId: "room",
        token: "jwt",
        apiKey: "pk",
      }),
    );
    expect(url.searchParams.get("v")).toBe(String(PROTOCOL_VERSION));
    expect(url.searchParams.get("v")).toBe("1");
  });
});

describe("buildChannelUpgradeUrl", () => {
  it("includes credentials and optional hints, and encodes the channel id", () => {
    const url = new URL(
      buildChannelUpgradeUrl({
        realtimeUrl: "wss://realtime.useportal.co",
        channelId: "room/with space",
        token: "jwt",
        apiKey: "pk",
        leaf: "leaf_3",
        last: 42,
      }),
    );
    expect(url.pathname).toBe("/v1/channels/room%2Fwith%20space");
    expect(url.searchParams.get("token")).toBe("jwt");
    expect(url.searchParams.get("key")).toBe("pk");
    expect(url.searchParams.get("leaf")).toBe("leaf_3");
    expect(url.searchParams.get("last")).toBe("42");
  });

  it("omits leaf, meta, and last when not provided", () => {
    const url = new URL(
      buildChannelUpgradeUrl({
        realtimeUrl: "wss://realtime.useportal.co",
        channelId: "room",
        token: "jwt",
        apiKey: "pk",
      }),
    );
    expect(url.searchParams.has("leaf")).toBe(false);
    expect(url.searchParams.has("meta")).toBe(false);
    expect(url.searchParams.has("last")).toBe(false);
  });
});

describe("upgradeUrlToHttpProbe", () => {
  it("swaps wss for https and ws for http", () => {
    expect(upgradeUrlToHttpProbe("wss://realtime.useportal.co/channels/room?v=1")).toBe(
      "https://realtime.useportal.co/channels/room?v=1",
    );
    expect(upgradeUrlToHttpProbe("ws://localhost:8787/channels/room")).toBe(
      "http://localhost:8787/channels/room",
    );
  });
});
