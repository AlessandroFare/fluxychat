import { describe, it, expect } from "vitest";
import { createWeb3Chat } from "./web3-chat";

describe("createWeb3Chat", () => {
  it("authWithWallet returns token", () => {
    const w3 = createWeb3Chat();
    const token = w3.authWithWallet({ address: "0x1234", chain: "ethereum" });
    expect(token).toMatch(/^w3a_/);
  });

  it("verifyAuth validates correct token", () => {
    const w3 = createWeb3Chat();
    const wallet = { address: "0x1234", chain: "ethereum" };
    const token = w3.authWithWallet(wallet);
    expect(w3.verifyAuth(token, wallet)).toBe(true);
  });

  it("verifyAuth rejects wrong wallet", () => {
    const w3 = createWeb3Chat();
    const token = w3.authWithWallet({ address: "0x1234", chain: "ethereum" });
    expect(w3.verifyAuth(token, { address: "0x9999", chain: "ethereum" })).toBe(false);
  });

  it("createRoom creates room with token gates", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Token Room", [
      { tokenAddress: "0xABC", chain: "ethereum", minBalance: "1" },
    ]);
    expect(room.tokenGates).toHaveLength(1);
  });

  it("joinRoom adds member", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    expect(w3.joinRoom(room.id, "0x1234")).toBe(true);
    const r = w3.getRoom(room.id)!;
    expect(r.members).toContain("0x1234");
  });

  it("leaveRoom removes member", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    w3.joinRoom(room.id, "0x1234");
    w3.leaveRoom(room.id, "0x1234");
    const r = w3.getRoom(room.id)!;
    expect(r.members).not.toContain("0x1234");
  });

  it("sendMessage creates message with commitment", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    w3.joinRoom(room.id, "0x1234");
    const msg = w3.sendMessage(room.id, "0x1234", "hello web3");
    expect(msg.commitment).toMatch(/^0x/);
    expect(msg.content).toBe("hello web3");
  });

  it("sendMessage throws for non-members", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    expect(() => w3.sendMessage(room.id, "0x9999", "hi")).toThrow("not a member");
  });

  it("getMessages returns room messages", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    w3.joinRoom(room.id, "0x1234");
    w3.sendMessage(room.id, "0x1234", "msg1");
    w3.sendMessage(room.id, "0x1234", "msg2");
    expect(w3.getMessages(room.id)).toHaveLength(2);
  });

  it("checkTokenGate returns true for no gates", () => {
    const w3 = createWeb3Chat();
    const room = w3.createRoom("Public");
    expect(w3.checkTokenGate(room.id, "0x1234")).toBe(true);
  });
});
