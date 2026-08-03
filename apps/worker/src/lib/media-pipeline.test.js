import { describe, it, expect, vi } from "vitest";
import {
  containsEicarSignature,
  EICAR_TEST_STRING,
  mapMediaSettingsRow,
  validateMediaUpload,
} from "./media-pipeline.js";

describe("media-pipeline", () => {
  it("maps default settings when row missing", () => {
    const settings = mapMediaSettingsRow(null);
    expect(settings.maxFileSizeBytes).toBe(10 * 1024 * 1024);
    expect(settings.avScanEnabled).toBe(true);
  });

  it("rejects oversize uploads", () => {
    const settings = mapMediaSettingsRow({
      project_id: "p1",
      max_file_size_bytes: 1024,
      max_attachments_per_message: 5,
      allowed_mime_types_json: JSON.stringify(["image/png"]),
      av_scan_enabled: 1,
      thumbnail_enabled: 1,
      updated_at: "2026-01-01T00:00:00Z",
    });
    const result = validateMediaUpload(settings, {
      contentType: "image/png",
      sizeBytes: 2048,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("file_too_large");
  });

  it("detects EICAR test signature", () => {
    const bytes = new TextEncoder().encode(EICAR_TEST_STRING);
    expect(containsEicarSignature(bytes)).toBe(true);
  });
});
