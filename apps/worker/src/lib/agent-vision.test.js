import { describe, expect, it } from "vitest";
import { userContentWithImages, imagePartsFromAttachments } from "./agent-vision.js";

describe("agent-vision", () => {
  it("userContentWithImages returns text when there are no images", () => {
    expect(userContentWithImages("hello", [])).toBe("hello");
  });

  it("userContentWithImages prepends a text part", () => {
    const parts = userContentWithImages("see this", [
      { type: "image_url", image_url: { url: "data:image/png;base64,abc" } },
    ]);
    expect(parts[0]).toEqual({ type: "text", text: "see this" });
    expect(parts[1].type).toBe("image_url");
  });

  it("skips non-image attachments", async () => {
    const parts = await imagePartsFromAttachments(
      { ATTACHMENTS: { get: async () => ({ arrayBuffer: async () => new ArrayBuffer(8) }) } },
      [{ kind: "file", url: "p1/u1/a.pdf", contentType: "application/pdf" }],
      "p1",
    );
    expect(parts).toEqual([]);
  });
});
