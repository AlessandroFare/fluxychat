/**
 * P24-15: Attachment Upload
 * File upload handling for chat messages.
 */

export type AttachmentType = "image" | "video" | "audio" | "document" | "archive" | "other";

export interface AttachmentConfig {
  /** Maximum file size in bytes */
  maxFileSize?: number;
  /** Allowed MIME types */
  allowedMimeTypes?: string[];
  /** Maximum number of attachments per message */
  maxAttachments?: number;
  /** Storage backend */
  storage?: "r2" | "kv" | "memory";
  /** R2 bucket name (if using R2) */
  r2Bucket?: string;
  /** CDN base URL for serving attachments */
  cdnBaseUrl?: string;
}

export interface Attachment {
  /** Unique ID */
  id: string;
  /** Original filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  size: number;
  /** Storage URL or key */
  url: string;
  /** CDN URL (if available) */
  cdnUrl?: string;
  /** Attachment type (derived from MIME) */
  type: AttachmentType;
  /** Width (for images/videos) */
  width?: number;
  /** Height (for images/videos) */
  height?: number;
  /** Duration in seconds (for audio/video) */
  durationMs?: number;
  /** Upload timestamp */
  uploadedAt: string;
  /** User who uploaded */
  uploadedBy: string;
}

export interface AttachmentUploadResult {
  success: boolean;
  attachment?: Attachment;
  error?: string;
}

export interface AttachmentManager {
  /** Upload a file */
  upload(file: File | ArrayBuffer, filename: string, mimeType: string, uploadedBy: string): Promise<AttachmentUploadResult>;
  /** Get an attachment by ID */
  get(id: string): Promise<Attachment | null>;
  /** Delete an attachment */
  delete(id: string): Promise<void>;
  /** List attachments for a message */
  listForMessage(messageId: string): Promise<Attachment[]>;
  /** Validate a file before upload */
  validate(file: { size: number; type: string }): { valid: boolean; error?: string };
}

export function createAttachmentManager(config?: AttachmentConfig): AttachmentManager {
  const maxSize = config?.maxFileSize ?? 10 * 1024 * 1024;
  const allowedMime = config?.allowedMimeTypes ?? [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "video/mp4", "video/webm",
    "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm",
    "application/pdf", "text/plain", "text/csv",
    "application/zip", "application/gzip",
  ];
  const maxAttach = config?.maxAttachments ?? 10;
  const store = new Map<string, Attachment>();
  const messageIndex = new Map<string, string[]>();

  return {
    async upload(file, filename, mimeType, uploadedBy) {
      const validation = this.validate({ size: file instanceof File ? file.size : file.byteLength, type: mimeType });
      if (!validation.valid) return { success: false, error: validation.error };

      const id = crypto.randomUUID();
      const size = file instanceof File ? file.size : file.byteLength;
      const type = mimeToAttachmentType(mimeType);

      const attachment: Attachment = {
        id, filename, mimeType, size, url: `memory://${id}`, type, uploadedAt: new Date().toISOString(), uploadedBy,
      };
      if (config?.cdnBaseUrl) attachment.cdnUrl = `${config.cdnBaseUrl}/${id}`;

      store.set(id, attachment);
      return { success: true, attachment };
    },

    async get(id) {
      return store.get(id) ?? null;
    },

    async delete(id) {
      store.delete(id);
    },

    async listForMessage(messageId) {
      const ids = messageIndex.get(messageId) ?? [];
      return ids.map((id) => store.get(id)).filter(Boolean) as Attachment[];
    },

    validate(file) {
      if (file.size > maxSize) return { valid: false, error: `File too large (max ${formatFileSize(maxSize)})` };
      if (!allowedMime.includes(file.type) && allowedMime.length > 0) return { valid: false, error: `MIME type not allowed: ${file.type}` };
      return { valid: true };
    },
  };
}

export function mimeToAttachmentType(mimeType: string): AttachmentType {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (["application/pdf", "text/plain", "text/csv", "application/json"].includes(mimeType)) return "document";
  if (["application/zip", "application/gzip", "application/x-tar", "application/x-7z-compressed"].includes(mimeType)) return "archive";
  return "other";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
