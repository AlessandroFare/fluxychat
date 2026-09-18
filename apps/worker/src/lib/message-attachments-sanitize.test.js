import { describe, expect, it } from "vitest";
import {
  MAX_ATTACHMENTS_PER_MESSAGE,
  sanitizeMessageAttachments,
} from "./message-attachments-sanitize.js";

describe("sanitizeMessageAttachments", () => {
  it("keeps https URLs and worker attachment paths", () => {
    const out = sanitizeMessageAttachments([
      { url: "https://cdn.example/a.png", name: "a.png", kind: "image", sizeBytes: 12, contentType: "image/png" },
      { url: "/attachments/proj/file-key", name: "file-key", kind: "file" },
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].url).toBe("https://cdn.example/a.png");
    expect(out[1].url).toBe("/attachments/proj/file-key");
  });

  it("drops javascript: and data: URLs", () => {
    const out = sanitizeMessageAttachments([
      { url: "javascript:alert(1)", name: "x" },
      { url: "data:text/html,hi", name: "y" },
      { url: "https://ok.example/z", name: "z" },
    ]);
    expect(out.map((a) => a.url)).toEqual(["https://ok.example/z"]);
  });

  it("drops path traversal on worker attachment paths", () => {
    expect(sanitizeMessageAttachments([{ url: "/attachments/../secret" }])).toEqual([]);
  });

  it(`caps at ${10} attachments`, () => {
    const raw = Array.from({ length: 15 }, (_, i) => ({ url: `https://cdn.example/${i}` }));
    expect(sanitizeMessageAttachments(raw)).toHaveLength(MAX_ATTACHMENTS_PER_MESSAGE);
  });
});
