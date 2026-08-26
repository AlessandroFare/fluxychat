import * as Y from "yjs";
import type { FluxyChatAttachment } from "./fluxy-chat-client";

/** Shared JSON map for `useStorage` (not the Tiptap XmlFragment). */
export const FLUXY_YJS_STORAGE_MAP = "storage";

/** Tiptap Collaboration XmlFragment name. */
export const FLUXY_YJS_EDITOR_FRAGMENT = "prosemirror";

export interface FluxyLiveFile {
  liveFile: true;
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

export type StorageJson = Record<string, unknown>;

export function isLiveFile(value: unknown): value is FluxyLiveFile {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return row.liveFile === true && typeof row.url === "string" && typeof row.name === "string";
}

export function liveFileFromAttachment(attachment: FluxyChatAttachment): FluxyLiveFile {
  return {
    liveFile: true,
    id: attachment.url,
    name: attachment.name,
    mime: attachment.contentType ?? "application/octet-stream",
    size: attachment.sizeBytes ?? 0,
    url: attachment.url,
  };
}

export async function uploadLiveFile(
  client: { uploadFile: (roomId: string, file: File) => Promise<FluxyChatAttachment> },
  roomId: string,
  file: File,
): Promise<FluxyLiveFile> {
  const attachment = await client.uploadFile(roomId, file);
  return liveFileFromAttachment(attachment);
}

export function yValueToJson(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const out: StorageJson = {};
    value.forEach((entry, key) => {
      out[key] = yValueToJson(entry);
    });
    return out;
  }
  if (value instanceof Y.Array) {
    return value.toArray().map((entry) => yValueToJson(entry));
  }
  if (value instanceof Y.Text) {
    return value.toString();
  }
  return value;
}

export function storageMapToJson(map: Y.Map<unknown>): StorageJson {
  const json = yValueToJson(map);
  return json && typeof json === "object" && !Array.isArray(json) ? (json as StorageJson) : {};
}

export function jsonToYValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (isLiveFile(value)) return { ...value };
  if (Array.isArray(value)) {
    const arr = new Y.Array();
    const items = value.map((item) => jsonToYValue(item));
    if (items.length) arr.insert(0, items);
    return arr;
  }
  if (typeof value === "object") {
    const map = new Y.Map();
    for (const [key, nested] of Object.entries(value as StorageJson)) {
      map.set(key, jsonToYValue(nested));
    }
    return map;
  }
  return value;
}

export function applyStoragePatch(map: Y.Map<unknown>, patch: StorageJson): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) {
      map.delete(key);
      continue;
    }
    map.set(key, jsonToYValue(value));
  }
}
