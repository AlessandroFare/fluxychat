import { describe, expect, it, vi } from "vitest";
import {
  attachmentUrlToR2Key,
  collectAttachmentR2Keys,
  deleteUserAttachmentObjects,
  r2KeyBelongsToProject,
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

  it("returns null for a URL without the /attachments/ prefix (audit F-09)", () => {
    expect(
      attachmentUrlToR2Key("https://evil.example/projB/userB/secret.png")
    ).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(attachmentUrlToR2Key("")).toBeNull();
    expect(attachmentUrlToR2Key(null)).toBeNull();
  });
});

describe("r2KeyBelongsToProject (audit F-09)", () => {
  it("accepts the project's own key spaces", () => {
    expect(r2KeyBelongsToProject("p1/u1/file.png", "p1")).toBe(true);
    expect(r2KeyBelongsToProject("ai-images/p1/i.png", "p1")).toBe(true);
    expect(r2KeyBelongsToProject("voice/p1/r1/1.webm", "p1")).toBe(true);
  });

  it("rejects other projects and scoped prefixes for other projects", () => {
    expect(r2KeyBelongsToProject("p2/u1/file.png", "p1")).toBe(false);
    expect(r2KeyBelongsToProject("ai-images/p2/i.png", "p1")).toBe(false);
    expect(r2KeyBelongsToProject("voice/p2/r1/1.webm", "p1")).toBe(false);
    expect(r2KeyBelongsToProject("", "p1")).toBe(false);
  });
});

describe("deleteUserAttachmentObjects (audit F-09)", () => {
  it("never deletes objects outside the project's key space", async () => {
    const deleted = [];
    const env = {
      ATTACHMENTS: {
        list: async () => ({ objects: [], truncated: false }),
        delete: async (key) => {
          deleted.push(key);
        },
      },
    };
    const result = await deleteUserAttachmentObjects(env, "p1", "u1", [
      { url: "/attachments/p1/u1/mine.png" },
      { url: "/attachments/p2/u2/theirs.png" },
    ]);
    expect(deleted).toEqual(["p1/u1/mine.png"]);
    expect(result.deleted).toBe(1);
    expect(result.warnings.some((w) => w.includes("outside_project_key_space"))).toBe(true);
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
