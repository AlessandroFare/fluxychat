import { describe, it, expect } from "vitest";
import { createAttachmentManager, mimeToAttachmentType, formatFileSize } from "./attachments";

describe("mimeToAttachmentType", () => {
  it("classifies image MIME types", () => {
    expect(mimeToAttachmentType("image/png")).toBe("image");
    expect(mimeToAttachmentType("image/jpeg")).toBe("image");
  });

  it("classifies video MIME types", () => {
    expect(mimeToAttachmentType("video/mp4")).toBe("video");
  });

  it("classifies audio MIME types", () => {
    expect(mimeToAttachmentType("audio/mpeg")).toBe("audio");
  });

  it("classifies document MIME types", () => {
    expect(mimeToAttachmentType("application/pdf")).toBe("document");
    expect(mimeToAttachmentType("text/plain")).toBe("document");
  });

  it("classifies archive MIME types", () => {
    expect(mimeToAttachmentType("application/zip")).toBe("archive");
  });

  it("defaults to other for unknown types", () => {
    expect(mimeToAttachmentType("application/octet-stream")).toBe("other");
  });
});

describe("formatFileSize", () => {
  it("formats bytes", () => expect(formatFileSize(500)).toBe("500 B"));
  it("formats KB", () => expect(formatFileSize(2048)).toBe("2.0 KB"));
  it("formats MB", () => expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB"));
  it("formats GB", () => expect(formatFileSize(3 * 1024 * 1024 * 1024)).toBe("3.0 GB"));
});

describe("createAttachmentManager", () => {
  it("uploads a file buffer", async () => {
    const mgr = createAttachmentManager();
    const buf = new ArrayBuffer(100);
    const result = await mgr.upload(buf, "test.png", "image/png", "user:1");
    expect(result.success).toBe(true);
    expect(result.attachment?.type).toBe("image");
    expect(result.attachment?.filename).toBe("test.png");
  });

  it("rejects oversized files", async () => {
    const mgr = createAttachmentManager({ maxFileSize: 50 });
    const buf = new ArrayBuffer(100);
    const result = await mgr.upload(buf, "big.txt", "text/plain", "user:1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("rejects disallowed MIME types", async () => {
    const mgr = createAttachmentManager({ allowedMimeTypes: ["image/png"] });
    const buf = new ArrayBuffer(100);
    const result = await mgr.upload(buf, "file.exe", "application/x-msdownload", "user:1");
    expect(result.success).toBe(false);
    expect(result.error).toContain("not allowed");
  });

  it("get returns null for missing", async () => {
    const mgr = createAttachmentManager();
    expect(await mgr.get("nonexistent")).toBeNull();
  });

  it("delete removes attachment", async () => {
    const mgr = createAttachmentManager();
    const buf = new ArrayBuffer(100);
    const { attachment } = await mgr.upload(buf, "doc.txt", "text/plain", "user:1");
    await mgr.delete(attachment!.id);
    expect(await mgr.get(attachment!.id)).toBeNull();
  });

  it("validate checks size", () => {
    const mgr = createAttachmentManager({ maxFileSize: 100 });
    expect(mgr.validate({ size: 50, type: "text/plain" }).valid).toBe(true);
    expect(mgr.validate({ size: 200, type: "text/plain" }).valid).toBe(false);
  });
});
