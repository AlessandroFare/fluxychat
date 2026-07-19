import { describe, it, expect } from "vitest";
import { createMcpNegotiation } from "./mcp-negotiation";

describe("createMcpNegotiation", () => {
  it("proposes highest common version", () => {
    const neg = createMcpNegotiation();
    const clientCaps = [
      { transport: "sse" as const, version: "v3" as const, features: ["tools", "resources"] },
      { transport: "streamable-http" as const, version: "v3" as const, features: ["tools"] },
    ];
    const result = neg.propose(clientCaps);
    expect(result.agreedVersion).toBe("v3");
    expect(result.agreedTransport).toBe("streamable-http");
  });

  it("negotiates down to v1 if needed", () => {
    const neg = createMcpNegotiation([
      { transport: "stdio", version: "v1", features: ["tools"] },
    ]);
    const clientCaps = [
      { transport: "stdio", version: "v1", features: ["tools"] },
    ];
    const result = neg.propose(clientCaps);
    expect(result.agreedVersion).toBe("v1");
    expect(result.agreedTransport).toBe("stdio");
  });

  it("returns supported versions and transports", () => {
    const neg = createMcpNegotiation();
    expect(neg.getSupportedVersions()).toContain("v3");
    expect(neg.getSupportedTransports()).toContain("streamable-http");
  });
});
