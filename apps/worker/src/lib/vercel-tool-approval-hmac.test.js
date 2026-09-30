import { describe, expect, it } from "vitest";
import { signVercelToolApproval, verifyVercelToolApproval } from "./vercel-tool-approval-hmac.js";

describe("vercel-tool-approval-hmac", () => {
  it("round-trips a signature bound to input", async () => {
    const secret = "tool-secret";
    const params = {
      approvalId: "apr_1",
      toolCallId: "call_1",
      toolName: "deleteFile",
      input: { path: "/tmp/x" },
    };
    const sig = await signVercelToolApproval(secret, params);
    expect(sig).toBeTruthy();
    expect(await verifyVercelToolApproval(secret, { ...params, signature: sig })).toBe(true);
    expect(
      await verifyVercelToolApproval(secret, {
        ...params,
        input: { path: "/etc/passwd" },
        signature: sig,
      }),
    ).toBe(false);
  });
});
