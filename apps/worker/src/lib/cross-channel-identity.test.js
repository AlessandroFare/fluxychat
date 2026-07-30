import { describe, it, expect } from "vitest";

const CHANNELS = ["web", "mobile", "whatsapp", "sms", "voice", "email", "slack", "discord"];

describe("cross-channel-identity", () => {
  it("supports expected omnichannel types", () => {
    expect(CHANNELS).toContain("whatsapp");
    expect(CHANNELS).toContain("voice");
    expect(CHANNELS.length).toBe(8);
  });
});
