import { describe, expect, it } from "vitest";
import protocolEvents from "../protocol-events.json" with { type: "json" };
import {
  FLUXY_INBOUND_EVENT_TYPES,
  FLUXY_OUTBOUND_EVENT_TYPES,
  FLUXY_PROTOCOL_VERSION,
} from "./event-types.js";

describe("protocol-events.json cross-SDK manifest", () => {
  it("matches TypeScript event registries", () => {
    expect([...protocolEvents.inbound].sort()).toEqual(
      [...FLUXY_INBOUND_EVENT_TYPES].sort(),
    );
    expect([...protocolEvents.outbound].sort()).toEqual(
      [...FLUXY_OUTBOUND_EVENT_TYPES].sort(),
    );
    expect(protocolEvents.version).toBe(FLUXY_PROTOCOL_VERSION);
  });
});
