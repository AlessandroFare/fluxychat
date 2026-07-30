import { describe, expect, it } from "vitest";
import { createMockFluxyRoomServer, parseFluxyInbound } from "./fluxy-mock-server";

describe("fluxy mock server harness", () => {
  it("records outbound client frames and parses inbound replay", () => {
    const server = createMockFluxyRoomServer({ roomId: "lobby" });
    const client = server.accept();
    client.send(JSON.stringify({ type: "ping" }));

    const outbound = server.getLastOutbound();
    expect(outbound?.type).toBe("ping");

    const parsed = parseFluxyInbound(
      JSON.stringify({ type: "replay", messages: [] }),
    );
    expect(parsed?.kind).toBe("replay");
  });
});
