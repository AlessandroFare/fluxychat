/**
 * P24-15: Attachment Upload — Worker Implementation
 */

const MIME_TO_TYPE = {
  "image/": "image",
  "video/": "video",
  "audio/": "audio",
  "application/pdf": "document",
  "application/msword": "document",
  "application/vnd.openxmlformats-officedocument": "document",
  "text/": "document",
  "application/zip": "archive",
  "application/x-rar": "archive",
  "application/gzip": "archive",
};

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DEFAULT_MAX_ATTACHMENTS = 5;

/**
 * Create an attachment manager.
 * @param {Object} config
 */
export function createAttachmentManager(config = {}) {
  const {
    maxFileSize = DEFAULT_MAX_SIZE,
    allowedMimeTypes = [],
    maxAttachments = DEFAULT_MAX_ATTACHMENTS,
    storage = "memory",
    cdnBaseUrl = "",
  } = config;

  const attachments = new Map(); // id -> Attachment

  return {
    async upload(file, filename, mimeType, uploadedBy) {
      // Validate
      const validation = this.validate({ size: file.byteLength || file.size, type: mimeType });
      if (!validation.valid) {
        return { success: false, error: validation.error };
      }

      const id = crypto.randomUUID();
      const type = mimeToAttachmentType(mimeType);

      // Store (in production, upload to R2 or similar)
      let url = "";
      if (storage === "r2") {
        // R2 upload logic
        url = `r2://attachments/${id}/${filename}`;
      } else {
        // In-memory or KV
        url = `attachment://${id}`;
      }

      const attachment = {
        id,
        filename,
        mimeType,
        size: file.byteLength || file.size,
        url,
        cdnUrl: cdnBaseUrl ? `${cdnBaseUrl}/${id}/${filename}` : undefined,
        type,
        uploadedAt: new Date().toISOString(),
        uploadedBy,
      };

      attachments.set(id, attachment);
      return { success: true, attachment };
    },

    async get(id) {
      return attachments.get(id) || null;
    },

    async delete(id) {
      attachments.delete(id);
    },

    async listForMessage(messageId) {
      // In production, query by messageId
      return [...attachments.values()];
    },

    validate(file) {
      if (file.size > maxFileSize) {
        return { valid: false, error: `File too large. Maximum size: ${formatFileSize(maxFileSize)}` };
      }
      if (allowedMimeTypes.length > 0 && !allowedMimeTypes.includes(file.type)) {
        return { valid: false, error: `File type not allowed: ${file.type}` };
      }
      return { valid: true };
    },
  };
}

/**
 * Determine attachment type from MIME type.
 * @param {string} mimeType
 */
export function mimeToAttachmentType(mimeType) {
  for (const [prefix, type] of Object.entries(MIME_TO_TYPE)) {
    if (mimeType.startsWith(prefix)) return type;
  }
  return "other";
}

/**
 * Format file size for display.
 * @param {number} bytes
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
