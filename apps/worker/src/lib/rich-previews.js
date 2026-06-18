/**
 * P17-J: Rich Message Previews + Formatting
 *
 * Server-side markdown rendering, link preview caching, file type detection,
 * and rich preview generation for chat messages.
 *
 * Architecture:
 * - Lightweight markdown parser (no npm deps) — chat-optimized subset
 * - Link preview cache in D1 with TTL expiration
 * - File type detection from MIME/extension with icon mapping
 * - Rich preview objects returned for client rendering
 *
 * Compounds:
 * - P12-K (browser_run) for OG preview fallback
 * - P12-A (embed) for widget rendering
 * - P15-F (embeddings) for content indexing
 */

import { fetchOgPreview } from "./message-enrichment.js";
import { isPrivateUrl } from "./url-ssrf.js";
import { logInfo } from "./worker-log.js";

const PREVIEW_CACHE_TTL_HOURS = 24;
const MAX_CONTENT_LENGTH = 10000;

// ── Markdown Rendering ──

/**
 * Lightweight markdown-to-HTML renderer for chat messages.
 * Supports: headers, bold, italic, code, code blocks, links, images,
 * lists (ordered/unordered), tables, blockquotes, horizontal rules.
 *
 * @param {string} markdown
 * @returns {string} HTML
 */
export function renderMarkdown(markdown) {
  if (!markdown) return "";
  let text = markdown;

  // Normalize line endings
  text = text.replace(/\r\n/g, "\n");

  // Fenced code blocks — extract first to avoid inner rendering
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push({ lang, code: escapeHtml(code.replace(/\n$/, "")) });
    return `\x00CODEBLOCK_${idx}\x00`;
  });

  // Inline code — extract to avoid inner rendering
  const inlineCodes = [];
  text = text.replace(/`([^`\n]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(escapeHtml(code));
    return `\x00INLINECODE_${idx}\x00`;
  });

  // Blockquotes  extract before global escape
  const blockquotes = [];
  text = text.replace(/^(?:>\s?.+\n?)+/gm, (match) => {
    const inner = escapeHtml(match.replace(/^>\s?/gm, "").trim());
    const idx = blockquotes.length;
    blockquotes.push(`<blockquote>${inner}</blockquote>`);
    return `\x00BLOCKQUOTE_${idx}\x00`;
  });

  // Tables  extract before global escape
  const tables = [];
  text = text.replace(/^(\|.+\|)\n(\|[-| :]+\|)\n((?:\|.+\|\n?)*)/gm, (_, header, sep, body) => {
    const headers = header.split("|").filter((c) => c.trim()).map((c) => `<th>${escapeHtml(c.trim())}</th>`);
    const rows = body.trim().split("\n").map((row) => {
      const cells = row.split("|").filter((c) => c.trim()).map((c) => `<td>${escapeHtml(c.trim())}</td>`);
      return `<tr>${cells.join("")}</tr>`;
    });
    const idx = tables.length;
    tables.push(
      `<table class="md-table"><thead><tr>${headers.join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`,
    );
    return `\x00TABLE_${idx}\x00`;
  });

  text = escapeHtml(text);

  // Audit S-5: allowlist http(s) URLs for any rendered link/image.
  // (After escapeHtml, the URL itself is already HTML-safe, but the protocol
  //  could be `javascript:`, `data:`, `vbscript:` etc.)
  const safeUrl = (raw) => {
    if (!raw) return null;
    const trimmed = String(raw).trim();
    if (!/^https?:\/\//i.test(trimmed)) return null;
    return trimmed;
  };

  // Horizontal rules
  text = text.replace(/^---+$/gm, "<hr>");

  // Headers
  text = text.replace(/^######\s+(.+)$/gm, "<h6>$1</h6>");
  text = text.replace(/^#####\s+(.+)$/gm, "<h5>$1</h5>");
  text = text.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
  text = text.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
  text = text.replace(/^##\s+(.+)$/gm, "<h2>$1</h2>");
  text = text.replace(/^#\s+(.+)$/gm, "<h1>$1</h1>");

  // Images (before links to avoid conflict)
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => {
    const safe = safeUrl(url);
    if (!safe) return escapeHtml(alt || "");
    return `<img src="${safe}" alt="${alt || ""}" class="md-image">`;
  });

  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const safe = safeUrl(url);
    if (!safe) return label;
    return `<a href="${safe}" target="_blank" rel="noopener" class="md-link">${label}</a>`;
  });

  // Bare URLs (not already in tags)
  text = text.replace(/(?<!["\(=])(https?:\/\/[^\s<>]+)/g, (url) => {
    const safe = safeUrl(url);
    if (!safe) return escapeHtml(url);
    return `<a href="${safe}" target="_blank" rel="noopener" class="md-link">${safe}</a>`;
  });

  // Bold + italic
  text = text.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Strikethrough alias
  text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");

  // Unordered lists
  text = text.replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>");
  text = text.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  // Ordered lists
  text = text.replace(/^\d+\.\s+(.+)$/gm, "<oli>$1</oli>");
  text = text.replace(/((?:<oli>.*<\/oli>\n?)+)/g, (match) => {
    return "<ol>" + match.replace(/<\/?oli>/g, (tag) => tag.replace("oli", "li")) + "</ol>";
  });

  // Line breaks
  text = text.replace(/\n/g, "<br>");

  // Restore code blocks
  text = text.replace(/\x00CODEBLOCK_(\d+)\x00/g, (_, idx) => {
    const block = codeBlocks[Number(idx)];
    const langClass = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : "";
    return `<pre class="md-code-block"><code${langClass}>${block.code}</code></pre>`;
  });

  // Restore inline code
  text = text.replace(/\x00INLINECODE_(\d+)\x00/g, (_, idx) => {
    return `<code class="md-inline-code">${inlineCodes[Number(idx)]}</code>`;
  });

  text = text.replace(/\x00BLOCKQUOTE_(\d+)\x00/g, (_, idx) => blockquotes[Number(idx)] ?? "");
  text = text.replace(/\x00TABLE_(\d+)\x00/g, (_, idx) => tables[Number(idx)] ?? "");

  return text;
}

/**
 * Extract structured preview data from markdown for client rendering.
 *
 * @param {string} markdown
 * @returns {{ hasCode: boolean, codeBlocks: Array<{lang: string, code: string}>, hasTable: boolean, hasLinks: boolean, links: string[], headings: string[], wordCount: number }}
 */
export function extractMarkdownFeatures(markdown) {
  if (!markdown) {
    return { hasCode: false, codeBlocks: [], hasTable: false, hasLinks: false, links: [], headings: [], wordCount: 0 };
  }

  const codeBlocks = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  let m;
  while ((m = codeBlockRegex.exec(markdown))) {
    codeBlocks.push({ lang: m[1] || "text", code: m[2].trim() });
  }

  const links = [];
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)|(?<!["\(=])(https?:\/\/[^\s<>]+)/g;
  while ((m = linkRegex.exec(markdown))) {
    links.push(m[2] || m[1]);
  }

  const headings = [];
  const headingRegex = /^#{1,6}\s+(.+)$/gm;
  while ((m = headingRegex.exec(markdown))) {
    headings.push(m[1].trim());
  }

  const hasTable = /^\|.+\|\n\|[-| :]+\|/m.test(markdown);
  const wordCount = markdown.split(/\s+/).filter(Boolean).length;

  return {
    hasCode: codeBlocks.length > 0,
    codeBlocks,
    hasTable,
    hasLinks: links.length > 0,
    links: [...new Set(links)],
    headings,
    wordCount,
  };
}

// ── Link Preview Cache ──

/**
 * Get a cached link preview or fetch and cache a new one.
 *
 * @param {object} env
 * @param {{ projectId: string, url: string }} input
 * @returns {Promise<{ title: string|null, description: string|null, imageUrl: string|null, siteName: string|null, url: string, cached: boolean } | null>}
 */
export async function getLinkPreview(env, input) {
  const { projectId, url } = input;
  if (!url || isPrivateUrl(url)) return null;

  // Check cache
  const cached = await env.DB.prepare(
    "SELECT * FROM link_previews WHERE project_id = ? AND url = ? AND (expires_at IS NULL OR expires_at > datetime('now'))"
  )
    .bind(projectId, url)
    .first();

  if (cached) {
    logInfo("link_preview.cache_hit", { projectId, url });
    return {
      title: cached.title,
      description: cached.description,
      imageUrl: cached.image_url,
      siteName: cached.site_name,
      contentType: cached.content_type,
      url: cached.url,
      cached: true,
    };
  }

  // Fetch fresh
  const preview = await fetchOgPreview(url, env);
  if (!preview) return null;

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + PREVIEW_CACHE_TTL_HOURS * 3600000).toISOString();

  try {
    await env.DB.prepare(
      `INSERT OR REPLACE INTO link_previews (id, project_id, url, title, description, image_url, site_name, content_type, fetched_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(id, projectId, url, preview.title, preview.description, preview.imageUrl, preview.siteName || null, preview.contentType || null, now, expiresAt)
      .run();
  } catch {
    // Non-critical — preview still returned
  }

  return {
    title: preview.title,
    description: preview.description,
    imageUrl: preview.imageUrl,
    siteName: preview.siteName || null,
    contentType: preview.contentType || null,
    url,
    cached: false,
  };
}

/**
 * Purge expired link previews.
 *
 * @param {object} env
 * @returns {Promise<{ ok: true, purged: number }>}
 */
export async function purgeExpiredPreviews(env) {
  const result = await env.DB.prepare(
    "DELETE FROM link_previews WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
  ).run();
  return { ok: true, purged: result.meta?.changes || 0 };
}

// ── File Type Detection ──

const MIME_ICONS = {
  // Images
  "image/png": "🖼️",
  "image/jpeg": "🖼️",
  "image/gif": "🖼️",
  "image/webp": "🖼️",
  "image/svg+xml": "🖼️",
  "image/avif": "🖼️",
  // Video
  "video/mp4": "🎬",
  "video/webm": "🎬",
  "video/quicktime": "🎬",
  // Audio
  "audio/mpeg": "🎵",
  "audio/ogg": "🎵",
  "audio/wav": "🎵",
  "audio/webm": "🎵",
  // Documents
  "application/pdf": "📄",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.ms-excel": "📊",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.ms-powerpoint": "📽️",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📽️",
  // Text
  "text/plain": "📃",
  "text/csv": "📊",
  "text/html": "🌐",
  "text/css": "🎨",
  "text/javascript": "⚡",
  "application/json": "📋",
  "application/xml": "📋",
  // Code
  "text/x-python": "🐍",
  "text/x-java": "☕",
  "text/x-c": "⚙️",
  "text/x-c++": "⚙️",
  "text/x-rust": "🦀",
  "text/x-go": "🐹",
  "text/x-shellscript": "🐚",
  // Archives
  "application/zip": "📦",
  "application/gzip": "📦",
  "application/x-tar": "📦",
  "application/x-7z-compressed": "📦",
  "application/x-rar-compressed": "📦",
  // Misc
  "application/octet-stream": "📎",
};

const EXT_ICONS = {
  ".png": "🖼️", ".jpg": "🖼️", ".jpeg": "🖼️", ".gif": "🖼️", ".webp": "🖼️", ".svg": "🖼️",
  ".mp4": "🎬", ".webm": "🎬", ".mov": "🎬",
  ".mp3": "🎵", ".ogg": "🎵", ".wav": "🎵",
  ".pdf": "📄", ".doc": "📝", ".docx": "📝",
  ".xls": "📊", ".xlsx": "📊", ".csv": "📊",
  ".ppt": "📽️", ".pptx": "📽️",
  ".txt": "📃", ".md": "📃", ".json": "📋", ".xml": "📋", ".yaml": "📋", ".yml": "📋",
  ".py": "🐍", ".js": "⚡", ".ts": "⚡", ".java": "☕", ".go": "🐹", ".rs": "🦀", ".c": "⚙️", ".cpp": "⚙️",
  ".zip": "📦", ".gz": "📦", ".tar": "📦", ".7z": "📦", ".rar": "📦",
  ".sh": "🐚", ".css": "🎨", ".html": "🌐",
};

/**
 * Detect file type and return icon + metadata.
 *
 * @param {{ filename?: string, mimeType?: string, size?: number }} input
 * @returns {{ icon: string, category: string, label: string, isPreviewable: boolean }}
 */
export function detectFileType(input) {
  const { filename, mimeType, size } = input;
  const mime = (mimeType || "").toLowerCase();
  const ext = filename ? getExtension(filename) : "";

  const icon = MIME_ICONS[mime] || EXT_ICONS[ext] || "📎";
  const category = getFileCategory(mime, ext);
  const label = getFileNameLabel(filename);
  const isPreviewable = isPreviewableType(mime, ext);

  return { icon, category, label, isPreviewable, size: size || null };
}

/**
 * Generate rich preview for a message.
 *
 * @param {{ content: string, attachments?: Array<{ filename?: string, mimeType?: string, size?: number }>, urls?: string[] }} input
 * @returns {object} Rich preview data
 */
export function generateRichPreview(input) {
  const { content, attachments, urls } = input;
  const features = extractMarkdownFeatures(content || "");
  const fileTypes = (attachments || []).map(detectFileType);
  const hasAttachments = fileTypes.length > 0;

  return {
    markdown: features,
    attachments: fileTypes,
    hasAttachments,
    hasCode: features.hasCode,
    hasTable: features.hasTable,
    hasLinks: features.hasLinks || hasAttachments,
    linkCount: features.links.length,
    attachmentCount: fileTypes.length,
    needsExpandedView: features.wordCount > 200 || features.codeBlocks.length > 0 || features.hasTable,
  };
}

// ── Helpers ──

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getExtension(filename) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot).toLowerCase() : "";
}

function getFileCategory(mime, ext) {
  if (mime.startsWith("image/") || [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"].includes(ext)) return "image";
  if (mime.startsWith("video/") || [".mp4", ".webm", ".mov"].includes(ext)) return "video";
  if (mime.startsWith("audio/") || [".mp3", ".ogg", ".wav", ".webm"].includes(ext)) return "audio";
  if (mime === "application/pdf" || ext === ".pdf") return "document";
  if (mime.includes("word") || [".doc", ".docx"].includes(ext)) return "document";
  if (mime.includes("sheet") || mime.includes("excel") || [".xls", ".xlsx", ".csv"].includes(ext)) return "spreadsheet";
  if (mime.includes("presentation") || [".ppt", ".pptx"].includes(ext)) return "presentation";
  if (mime.startsWith("text/") || [".json", ".xml", ".yaml", ".yml", ".py", ".js", ".ts", ".go", ".rs", ".c", ".cpp", ".java", ".sh", ".css"].includes(ext)) return "code";
  if (["zip", "gzip", "tar", "rar", "7z"].some((a) => mime.includes(a)) || [".zip", ".gz", ".tar", ".rar", ".7z"].includes(ext)) return "archive";
  return "file";
}

function getFileNameLabel(filename) {
  if (!filename) return "File";
  const ext = getExtension(filename);
  const base = ext ? filename.slice(0, -ext.length) : filename;
  return base.length > 30 ? base.slice(0, 27) + "..." + ext : filename;
}

function isPreviewableType(mime, ext) {
  if (mime.startsWith("image/")) return true;
  if (mime.startsWith("video/")) return true;
  if (mime.startsWith("audio/")) return true;
  if (mime === "application/pdf" || ext === ".pdf") return true;
  if (mime.startsWith("text/") && !mime.includes("html")) return true;
  if ([".json", ".xml", ".yaml", ".yml", ".py", ".js", ".ts", ".go", ".rs", ".c", ".cpp", ".java", ".sh", ".css", ".md", ".csv"].includes(ext)) return true;
  return false;
}

