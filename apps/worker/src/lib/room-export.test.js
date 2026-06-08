import { describe, expect, it } from "vitest";
import {
  buildRoomMarkdown,
  buildRoomPdf,
  buildSimplePdf,
  markdownToPlainLines,
} from "./room-export.js";

describe("room-export", () => {
  it("buildRoomMarkdown formats thread replies", () => {
    const md = buildRoomMarkdown({
      projectId: "proj_1",
      room: { id: "room_1", name: "Support" },
      messages: [
        { id: 1, userId: "alice", content: "Need help", createdAt: "2026-06-08T10:00:00.000Z" },
        {
          id: 2,
          userId: "bob",
          content: "Sure thing",
          parentId: 1,
          createdAt: "2026-06-08T10:01:00.000Z",
        },
      ],
      exportedAt: "2026-06-08T12:00:00.000Z",
    });
    expect(md).toContain("# Room export: Support");
    expect(md).toContain("Reply to **alice**");
    expect(md).toContain("> Sure thing");
  });

  it("buildSimplePdf returns valid PDF header and eof", () => {
    const pdf = buildSimplePdf(["Line one", "Line two"]);
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdf).toContain("/Type /Catalog");
  });

  it("buildRoomPdf includes room metadata", () => {
    const pdf = buildRoomPdf({
      projectId: "proj_1",
      room: { id: "room_1", name: "Support" },
      messages: [{ id: 1, userId: "alice", content: "Hi", createdAt: "t1" }],
      exportedAt: "2026-06-08T12:00:00.000Z",
    });
    const plain = markdownToPlainLines("Room: Support");
    expect(pdf).toContain("%PDF-1.4");
    expect(plain[0]).toContain("Room: Support");
  });
});
