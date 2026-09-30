import { describe, expect, it, vi } from "vitest";
import { FluxyChatClient } from "./fluxy-chat-client";
import { openaiAgentsRequireApproval } from "./approval-adapters";

describe("openaiAgentsRequireApproval", () => {
  it("posts /approvals/require", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ roomId: "r1", approvalId: "a1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new FluxyChatClient({ baseUrl: "https://worker.example", userId: "u", token: "jwt" });
    const requireApproval = openaiAgentsRequireApproval(client);
    await expect(requireApproval("deleteFile", { path: "/tmp" }, ["u2"])).resolves.toEqual({
      roomId: "r1",
      approvalId: "a1",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/approvals/require");
    vi.unstubAllGlobals();
  });
});
