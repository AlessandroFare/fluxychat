import { describe, it, expect } from "vitest";
import { createFederationBridge } from "./federation-bridge";

describe("federation-bridge", () => {
  it("should add a bridge config", () => {
    const f = createFederationBridge();
    f.addBridge({ protocol: "matrix", remoteUrl: "https://matrix.example.com", syncIntervalMs: 30000, complianceMode: "dma" });
    expect(f.getBridge("matrix")?.remoteUrl).toBe("https://matrix.example.com");
  });

  it("should remove a bridge", () => {
    const f = createFederationBridge();
    f.addBridge({ protocol: "matrix", remoteUrl: "https://matrix.example.com", syncIntervalMs: 30000, complianceMode: "dma" });
    f.removeBridge("matrix");
    expect(f.getBridge("matrix")).toBeNull();
  });

  it("should link identities", () => {
    const f = createFederationBridge();
    const id = f.linkIdentity("local-1", "remote-1", "matrix", "Alice");
    expect(id.displayName).toBe("Alice");
  });

  it("should bridge messages", () => {
    const f = createFederationBridge();
    const msg = f.bridgeMessage("matrix", { protocol: "matrix", remoteMessageId: "rm-1", localMessageId: "lm-1", roomId: "room-1", senderId: "user-1", content: "Hello from Matrix", timestamp: new Date().toISOString() });
    expect(msg.bridgeId).toMatch(/^bridge-/);
    expect(f.getBridgedMessages("room-1")).toHaveLength(1);
  });

  it("should return bridge status", () => {
    const f = createFederationBridge();
    f.addBridge({ protocol: "matrix", remoteUrl: "https://matrix.example.com", syncIntervalMs: 30000, complianceMode: "dma" });
    f.addBridge({ protocol: "activitypub", remoteUrl: "https://ap.example.com", syncIntervalMs: 60000, complianceMode: "gdpr" });
    expect(f.getStatus()).toHaveLength(2);
  });
});
