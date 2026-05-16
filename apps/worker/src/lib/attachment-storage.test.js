import { describe, expect, it } from "vitest";
import {
  attachmentUrlToR2Key,
  collectAttachmentR2Keys,
  userUploadR2Prefix,
} from "./attachment-storage.js";

describe("attachmentUrlToR2Key", () => {
  it("returns bare keys unchanged", () => {
    const key = "proj/u1/123_uuid.png";
    expect(attachmentUrlToR2Key(key)).toBe(key);
  });

  it("extracts key from /attachments/ URL path", () => {
    expect(
      attachmentUrlToR2Key(
        "https://api.example.com/attachments/proj%2Fu1%2Ffile.png"
      )
    ).toBe("proj/u1/file.png");
  });

  it("returns null for invalid input", () => {
    expect(attachmentUrlToR2Key("")).toBeNull();
    expect(attachmentUrlToR2Key(null)).toBeNull();
  });
});

describe("collectAttachmentR2Keys", () => {
  it("deduplicates keys from mixed rows", () => {
    const keys = collectAttachmentR2Keys([
      { url: "proj/u1/a.png" },
      { url: "https://x.test/attachments/proj/u1/a.png" },
      { url: "proj/u1/b.png" },
    ]);
    expect(keys.sort()).toEqual(["proj/u1/a.png", "proj/u1/b.png"]);
  });
});

describe("userUploadR2Prefix", () => {
  it("builds project/user prefix", () => {
    expect(userUploadR2Prefix("p1", "u1")).toBe("p1/u1/");
  });
});
