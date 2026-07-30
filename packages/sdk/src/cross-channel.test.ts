import { describe, it, expect } from "vitest";
import { createCrossChannelContinuity } from "./cross-channel";

describe("createCrossChannelContinuity", () => {
  it("creates and retrieves a session", () => {
    const ccc = createCrossChannelContinuity();
    const session = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    expect(session.id).toBeDefined();
    expect(session.userId).toBe("user-1");
    expect(session.identities).toHaveLength(1);
    expect(ccc.getSession(session.id)).toBeDefined();
  });

  it("getSessionByUser returns session by user id", () => {
    const ccc = createCrossChannelContinuity();
    ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    const got = ccc.getSessionByUser("user-1");
    expect(got).toBeDefined();
    expect(got!.userId).toBe("user-1");
  });

  it("linkIdentity adds a new identity to session", () => {
    const ccc = createCrossChannelContinuity();
    const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    const updated = ccc.linkIdentity(s.id, { channel: "mobile", externalId: "mobile-1" });
    expect(updated.identities).toHaveLength(2);
  });

  it("unlinkIdentity removes identity and updates activeChannel", () => {
    const ccc = createCrossChannelContinuity();
    const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    ccc.linkIdentity(s.id, { channel: "mobile", externalId: "mobile-1" });
    const updated = ccc.unlinkIdentity(s.id, "web");
    expect(updated.identities).toHaveLength(1);
    expect(updated.activeChannel).toBe("mobile");
  });

  it("unlinkIdentity throws when no identities remain", () => {
    const ccc = createCrossChannelContinuity();
    const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    expect(() => ccc.unlinkIdentity(s.id, "web")).toThrow("no remaining identities");
  });

  it("switchChannel changes active channel", () => {
    const ccc = createCrossChannelContinuity();
    const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    ccc.linkIdentity(s.id, { channel: "mobile", externalId: "mobile-1" });
    const updated = ccc.switchChannel(s.id, "mobile");
    expect(updated.activeChannel).toBe("mobile");
  });

  it("switchChannel throws for unlinked channel", () => {
    const ccc = createCrossChannelContinuity();
    const s = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    expect(() => ccc.switchChannel(s.id, "mobile")).toThrow('No identity for channel "mobile"');
  });

  it("getLinkedSessions returns sessions by identity", () => {
    const ccc = createCrossChannelContinuity();
    const s1 = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    const s2 = ccc.createSession("user-2", { channel: "web", externalId: "web-1" });
    const linked = ccc.getLinkedSessions({ channel: "web", externalId: "web-1" });
    expect(linked).toHaveLength(2);
    expect(linked.map((l) => l.userId)).toEqual(["user-1", "user-2"]);
  });

  it("shareContext copies metadata between sessions", () => {
    const ccc = createCrossChannelContinuity();
    const s1 = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    const s2 = ccc.createSession("user-1", { channel: "mobile", externalId: "mobile-1" });
    const from = ccc.getSession(s1.id)!;
    from.metadata.topic = "support";
    ccc.shareContext(s1.id, s2.id);
    const to = ccc.getSession(s2.id)!;
    expect(to.metadata.topic).toBe("support");
  });

  it("shareContext with keys only copies specified keys", () => {
    const ccc = createCrossChannelContinuity();
    const s1 = ccc.createSession("user-1", { channel: "web", externalId: "web-1" });
    const s2 = ccc.createSession("user-1", { channel: "mobile", externalId: "mobile-1" });
    const from = ccc.getSession(s1.id)!;
    from.metadata.a = 1;
    from.metadata.b = 2;
    ccc.shareContext(s1.id, s2.id, ["a"]);
    const to = ccc.getSession(s2.id)!;
    expect(to.metadata.a).toBe(1);
    expect(to.metadata.b).toBeUndefined();
  });
});
