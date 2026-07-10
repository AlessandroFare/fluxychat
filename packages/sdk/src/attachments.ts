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
  throw new Error("createAttachmentManager not implemented in SDK - use worker runtime");
}

/**
 * Determine attachment type from MIME type.
 */
export function mimeToAttachmentType(mimeType: string): AttachmentType {
  throw new Error("mimeToAttachmentType not implemented in SDK - use worker runtime");
}

/**
 * Format file size for display.
 */
export function formatFileSize(bytes: number): string {
  throw new Error("formatFileSize not implemented in SDK - use worker runtime");
}
