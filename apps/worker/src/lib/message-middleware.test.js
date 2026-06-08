import { describe, expect, it } from "vitest";
import { runInboundMessageMiddleware } from "./message-middleware.js";

describe("runInboundMessageMiddleware", () => {
  it("rejects empty content", async () => {
    const r = await runInboundMessageMiddleware({}, { content: "   " });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("invalid_content");
  });

  it("blocks when MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH and substring hit", async () => {
    const r = await runInboundMessageMiddleware(
      {
        MESSAGE_MIDDLEWARE_BLOCK_ON_MATCH: "true",
        BUILTIN_MODERATION_BLOCKED_SUBSTRINGS: "badword",
      },
      { content: "hello badword here" },
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("content_blocked");
  });

  it("allows with moderation hint when block on match is off", async () => {
    const r = await runInboundMessageMiddleware(
      {
        BUILTIN_MODERATION_BLOCKED_SUBSTRINGS: "badword",
      },
      { content: "hello badword" },
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.meta?.moderationHint).toContain("badword");
  });
});
