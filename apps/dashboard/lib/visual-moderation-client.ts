import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

const BASE = getPublicWorkerUrl();

export interface VisualModerationFrameResult {
  ok: boolean;
  flagged?: boolean;
  categories?: string[];
  action?: string;
  score?: number;
  error?: string;
  queued?: boolean;
}

export interface CaptureFrameOptions {
  width?: number;
  height?: number;
  quality?: number;
}

/**
 * Capture a JPEG base64 frame from a video or canvas element (no data: prefix).
 */
export function captureElementFrame(
  element: HTMLVideoElement | HTMLCanvasElement,
  options: CaptureFrameOptions = {},
): string | null {
  const width = (options.width ?? (element instanceof HTMLVideoElement ? element.videoWidth : element.width)) || 640;
  const height = (options.height ?? (element instanceof HTMLVideoElement ? element.videoHeight : element.height)) || 360;
  if (width <= 0 || height <= 0) return null;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  if (element instanceof HTMLVideoElement) {
    ctx.drawImage(element, 0, 0, width, height);
  } else {
    ctx.drawImage(element, 0, 0, width, height);
  }

  const dataUrl = canvas.toDataURL("image/jpeg", options.quality ?? 0.72);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

/**
 * Build a synthetic demo frame when no live video element is available.
 */
export function captureDemoFrame(label: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 360;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const gradient = ctx.createLinearGradient(0, 0, 640, 360);
  gradient.addColorStop(0, "#1e1b4b");
  gradient.addColorStop(1, "#6366f1");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 640, 360);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px system-ui,sans-serif";
  ctx.fillText(label.slice(0, 48), 24, 48);
  ctx.font = "14px system-ui,sans-serif";
  ctx.fillText(new Date().toISOString(), 24, 80);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function moderateStreamFrame(
  token: string,
  eventId: string,
  input: { imageBase64: string; frameIndex?: number; roomId?: string },
): Promise<VisualModerationFrameResult> {
  return fetchWorkerJson<VisualModerationFrameResult>(
    `${BASE}/api/live/events/${encodeURIComponent(eventId)}/moderate-frame`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    },
  );
}
