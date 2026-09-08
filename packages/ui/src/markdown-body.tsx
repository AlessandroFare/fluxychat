import * as React from "react";
import {
  parseMarkdown,
  type Content,
  type Root,
} from "@fluxy-chat/sdk/markdown";
import { cn } from "./lib/utils";
import { safeUrl } from "./safe-url";

const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)(?:[?#]|$)/i;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp)(?:[?#]|$)/i;

function cellAlignClass(align: Array<"left" | "right" | "center" | null> | null | undefined, index: number): string | undefined {
  const a = align?.[index];
  if (a === "center") return "text-center";
  if (a === "right") return "text-right";
  if (a === "left") return "text-left";
  return undefined;
}

function youtubeEmbedSrc(raw: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  let id = "";
  if (host === "youtu.be") {
    id = parsed.pathname.split("/").filter(Boolean)[0] || "";
  } else if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname.startsWith("/embed/")) {
      id = parsed.pathname.split("/").filter(Boolean)[1] || "";
    } else {
      id = parsed.searchParams.get("v") || "";
    }
  }
  if (!id || !/^[\w-]{6,}$/.test(id)) return undefined;
  return `https://www.youtube-nocookie.com/embed/${id}`;
}

function vimeoEmbedSrc(raw: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return undefined;
  }
  const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
  if (host === "player.vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[1] || "";
    return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : undefined;
  }
  if (host === "vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[0] || "";
    return /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : undefined;
  }
  return undefined;
}

function attrFromTag(tag: string, name: string): string | undefined {
  const re = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i");
  const match = re.exec(tag);
  return match?.[2] ?? match?.[3];
}

function MediaFrame({
  src,
  title,
}: {
  src: string;
  title?: string;
}): React.ReactNode {
  return (
    <div className="mb-2 aspect-video w-full max-w-lg overflow-hidden rounded-md last:mb-0">
      <iframe
        src={src}
        title={title || "Embedded video"}
        className="size-full border-0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
        loading="lazy"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}

function renderMediaUrl(url: string, alt: string, key: string, title?: string): React.ReactNode {
  const href = safeUrl(url, { allowData: true });
  if (!href) return alt || null;

  const yt = youtubeEmbedSrc(href);
  if (yt) return <MediaFrame key={key} src={yt} title={alt || title} />;

  const vimeo = vimeoEmbedSrc(href);
  if (vimeo) return <MediaFrame key={key} src={vimeo} title={alt || title} />;

  if (VIDEO_EXT.test(href)) {
    return (
      <video
        key={key}
        src={href}
        controls
        playsInline
        preload="metadata"
        className="mb-2 max-h-80 w-full max-w-lg rounded-md last:mb-0"
      />
    );
  }

  return (
    <img
      key={key}
      src={href}
      alt={alt}
      title={title}
      loading="lazy"
      className="mb-2 max-h-80 max-w-full rounded-md object-contain last:mb-0"
    />
  );
}

function renderSafeHtml(value: string, key: string): React.ReactNode {
  const trimmed = value.trim();
  if (!trimmed.startsWith("<") || trimmed.length > 2000) return null;
  if (/<script\b|on\w+\s*=/i.test(trimmed)) return null;

  const img = /^<img\b[^>]*\/?\s*>$/i.exec(trimmed);
  if (img) {
    const src = attrFromTag(trimmed, "src");
    const alt = attrFromTag(trimmed, "alt") || "";
    const title = attrFromTag(trimmed, "title");
    if (!src) return null;
    return renderMediaUrl(src, alt, key, title);
  }

  const video = /^<video\b[^>]*>[\s\S]*<\/video>$/i.exec(trimmed) || /^<video\b[^>]*\/?\s*>$/i.exec(trimmed);
  if (video) {
    const src = attrFromTag(trimmed, "src");
    if (!src) return null;
    return renderMediaUrl(src, "", key);
  }

  const iframe = /^<iframe\b[^>]*>[\s\S]*<\/iframe>$/i.exec(trimmed);
  if (iframe) {
    const src = attrFromTag(trimmed, "src");
    if (!src) return null;
    const safe = safeUrl(src);
    if (!safe) return null;
    const embed = youtubeEmbedSrc(safe) || vimeoEmbedSrc(safe);
    if (!embed) return null;
    return <MediaFrame key={key} src={embed} title={attrFromTag(trimmed, "title")} />;
  }

  return null;
}

function renderNodes(nodes: Content[], keyPrefix: string): React.ReactNode[] {
  return nodes.map((node, index) => renderNode(node, `${keyPrefix}-${index}`));
}

function renderNode(node: Content, key: string): React.ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "strong":
      return <strong key={key}>{renderNodes(node.children, key)}</strong>;
    case "emphasis":
      return <em key={key}>{renderNodes(node.children, key)}</em>;
    case "delete":
      return <del key={key}>{renderNodes(node.children, key)}</del>;
    case "inlineCode":
      return (
        <code
          key={key}
          className="rounded bg-black/10 px-1 py-0.5 font-mono text-[0.85em] dark:bg-white/10"
        >
          {node.value}
        </code>
      );
    case "link": {
      const href = safeUrl(node.url);
      if (!href) return renderNodes(node.children, key);
      if (IMAGE_EXT.test(href) || VIDEO_EXT.test(href) || youtubeEmbedSrc(href) || vimeoEmbedSrc(href)) {
        const alt = node.children.map((c) => ("value" in c ? String(c.value) : "")).join("") || node.title || "";
        return renderMediaUrl(href, alt, key, node.title || undefined);
      }
      return (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          className="underline underline-offset-2"
        >
          {renderNodes(node.children, key)}
        </a>
      );
    }
    case "image": {
      return renderMediaUrl(node.url, node.alt || "", key, node.title || undefined);
    }
    case "paragraph":
      return (
        <p key={key} className="mb-2 last:mb-0">
          {renderNodes(node.children, key)}
        </p>
      );
    case "heading": {
      const level = Math.min(Math.max(node.depth, 1), 6);
      const headingProps = { key, className: "mb-2 mt-3 font-semibold first:mt-0" };
      if (level === 1) return <h1 {...headingProps}>{renderNodes(node.children, key)}</h1>;
      if (level === 2) return <h2 {...headingProps}>{renderNodes(node.children, key)}</h2>;
      if (level === 3) return <h3 {...headingProps}>{renderNodes(node.children, key)}</h3>;
      if (level === 4) return <h4 {...headingProps}>{renderNodes(node.children, key)}</h4>;
      if (level === 5) return <h5 {...headingProps}>{renderNodes(node.children, key)}</h5>;
      return <h6 {...headingProps}>{renderNodes(node.children, key)}</h6>;
    }
    case "blockquote":
      return (
        <blockquote
          key={key}
          className="mb-2 border-l-2 border-current/30 pl-3 opacity-90 last:mb-0"
        >
          {renderNodes(node.children, key)}
        </blockquote>
      );
    case "list":
      return node.ordered ? (
        <ol key={key} className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">
          {renderNodes(node.children, key)}
        </ol>
      ) : (
        <ul key={key} className="mb-2 list-disc space-y-1 pl-5 last:mb-0">
          {renderNodes(node.children, key)}
        </ul>
      );
    case "listItem": {
      if (typeof node.checked === "boolean") {
        return (
          <li key={key} className="list-none">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={node.checked}
                readOnly
                disabled
                className="mt-1"
              />
              <span>{renderNodes(node.children, key)}</span>
            </label>
          </li>
        );
      }
      return <li key={key}>{renderNodes(node.children, key)}</li>;
    }
    case "code":
      return (
        <pre
          key={key}
          className="mb-2 overflow-x-auto rounded-md bg-black/10 p-2 font-mono text-xs last:mb-0 dark:bg-white/10"
        >
          <code>{node.value}</code>
        </pre>
      );
    case "break":
      return <br key={key} />;
    case "thematicBreak":
      return <hr key={key} className="my-3 border-current/20" />;
    case "table": {
      const align = node.align;
      const rows = node.children;
      const header = rows[0];
      const bodyRows = rows.slice(1);
      const cellClass =
        "border border-current/15 px-2 py-1.5 align-top";
      function renderRow(row: (typeof rows)[number], rowKey: string, headerRow: boolean) {
        const Tag = headerRow ? "th" : "td";
        return (
          <tr key={rowKey} className={headerRow ? "font-semibold" : undefined}>
            {row.children.map((cell, cellIndex) => (
              <Tag
                key={`${rowKey}-c${cellIndex}`}
                className={cn(cellClass, headerRow && "bg-black/5 dark:bg-white/10", cellAlignClass(align, cellIndex))}
              >
                {renderNodes(cell.children as Content[], `${rowKey}-c${cellIndex}`)}
              </Tag>
            ))}
          </tr>
        );
      }
      return (
        <div key={key} className="mb-2 max-w-full overflow-x-auto last:mb-0">
          <table className="w-max min-w-full border-collapse text-xs leading-snug">
            {header ? <thead>{renderRow(header, `${key}-h`, true)}</thead> : null}
            {bodyRows.length > 0 ? (
              <tbody>{bodyRows.map((row, i) => renderRow(row, `${key}-b${i}`, false))}</tbody>
            ) : null}
          </table>
        </div>
      );
    }
    case "html":
      return renderSafeHtml(node.value, key);
    default:
      if ("children" in node && Array.isArray(node.children)) {
        return <React.Fragment key={key}>{renderNodes(node.children as Content[], key)}</React.Fragment>;
      }
      return null;
  }
}

function renderRoot(ast: Root): React.ReactNode {
  return renderNodes(ast.children, "md");
}

export interface MarkdownBodyProps {
  content: string;
  className?: string;
  /** Lighter text on sent (primary) bubbles. */
  invert?: boolean;
}

/** Render assistant/user markdown (GFM) inside message bubbles. */
export function MarkdownBody({ content, className, invert }: MarkdownBodyProps) {
  const body = React.useMemo(() => {
    if (!content.trim()) return null;
    try {
      return renderRoot(parseMarkdown(content));
    } catch {
      return content;
    }
  }, [content]);

  return (
    <div
      className={cn(
        "fluxy-markdown text-sm leading-relaxed [&_a]:font-medium",
        invert && "[&_a]:text-white/95 [&_th]:bg-white/10 [&_td]:border-white/25 [&_th]:border-white/25",
        className,
      )}
    >
      {body}
    </div>
  );
}
