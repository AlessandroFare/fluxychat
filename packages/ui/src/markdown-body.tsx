import * as React from "react";
import {
  parseMarkdown,
  type Content,
  type Root,
} from "@fluxy-chat/sdk/markdown";
import { cn } from "./lib/utils";
import { safeUrl } from "./safe-url";

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
    case "listItem":
      return <li key={key}>{renderNodes(node.children, key)}</li>;
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
        invert && "[&_a]:text-white/95",
        className,
      )}
    >
      {body}
    </div>
  );
}
