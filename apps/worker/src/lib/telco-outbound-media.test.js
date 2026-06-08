import { describe, it, expect } from "vitest";
import {
  buildTelcoMediaTemplateParams,
  formatTelcoMessagePreview,
  inferTelcoMediaType,
  isTelcoOutboundMediaEnabled,
  pickTelcoMediaAttachment,
  resolvePublicAttachmentUrl,
} from "./telco-outbound-media.js";

describe("telco-outbound-media", () => {
  const env = { PUBLIC_APP_URL: "https://app.fluxy.chat" };

  it("isTelcoOutboundMediaEnabled defaults on unless explicitly disabled", () => {
    expect(isTelcoOutboundMediaEnabled({})).toBe(true);
    expect(isTelcoOutboundMediaEnabled({ OFFLINE_SMS_MEDIA_ENABLED: "false" })).toBe(false);
  });

  it("resolvePublicAttachmentUrl handles absolute and worker-relative paths", () => {
    expect(resolvePublicAttachmentUrl(env, "https://cdn.example/a.png")).toBe(
      "https://cdn.example/a.png",
    );
    expect(resolvePublicAttachmentUrl(env, "/attachments/voice/p/r/1.webm")).toBe(
      "https://app.fluxy.chat/attachments/voice/p/r/1.webm",
    );
    expect(resolvePublicAttachmentUrl({}, "/attachments/x")).toBeNull();
  });

  it("inferTelcoMediaType classifies by kind and content type", () => {
    expect(inferTelcoMediaType({ kind: "image" })).toBe("image");
    expect(inferTelcoMediaType({ contentType: "video/mp4" })).toBe("video");
    expect(inferTelcoMediaType({ kind: "file", contentType: "application/pdf" })).toBe(
      "document",
    );
  });

  it("pickTelcoMediaAttachment prefers image over document", () => {
    const picked = pickTelcoMediaAttachment(env, [
      { kind: "file", url: "https://cdn.example/doc.pdf" },
      { kind: "image", url: "https://cdn.example/photo.jpg" },
    ]);
    expect(picked?.url).toContain("photo.jpg");
  });

  it("buildTelcoMediaTemplateParams returns Sent.dm parameter keys", () => {
    const params = buildTelcoMediaTemplateParams(env, {
      kind: "image",
      url: "/attachments/proj/room/1.png",
      name: "screenshot.png",
    });
    expect(params).toEqual({
      media_url: "https://app.fluxy.chat/attachments/proj/room/1.png",
      media_name: "screenshot.png",
      media_type: "image",
      has_media: "true",
    });
  });

  it("formatTelcoMessagePreview uses media fallback when content empty", () => {
    expect(formatTelcoMessagePreview("", { has_media: "true", media_type: "image" })).toBe(
      "Photo",
    );
    expect(formatTelcoMessagePreview("hello", { has_media: "true" })).toBe("hello");
  });
});
