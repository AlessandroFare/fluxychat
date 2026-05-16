import * as React from "react";
import type { FluxyChatMessage } from "@fluxychat/sdk";

export interface MessageListProps {
  messages: FluxyChatMessage[];
  /** Per-row estimate (px); tune with your bubble density. Default 92. */
  estimatedRowHeight?: number;
  overscan?: number;
  /** When false, renders all rows (tiny lists); when true, windowed slice. Default: messages.length > 24 */
  virtualization?: boolean;
  renderMessage: (message: FluxyChatMessage) => React.ReactNode;
  /** Typing dots, AgentTypingIndicator, etc. */
  footer?: React.ReactNode;
  listStyle?: React.CSSProperties;
  onScrollNearTop?: () => void;
}

/**
 * Vertical list with lightweight windowing for long transcripts.
 * No extra deps — uses estimated row heights (best for roughly uniform bubbles).
 */
export function MessageList({
  messages,
  estimatedRowHeight = 92,
  overscan = 5,
  virtualization = messages.length > 24,
  renderMessage,
  footer,
  listStyle,
  onScrollNearTop,
}: MessageListProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = React.useState(0);
  const [viewportH, setViewportH] = React.useState(400);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewportH(el.clientHeight || 400));
    ro.observe(el);
    setViewportH(el.clientHeight || 400);
    return () => ro.disconnect();
  }, []);

  const handleScroll = () => {
    const el = ref.current;
    if (!el) return;
    const st = el.scrollTop;
    setScrollTop(st);
    if (onScrollNearTop && st < estimatedRowHeight) onScrollNearTop();
  };

  const rowH = estimatedRowHeight;

  let body: React.ReactNode;

  if (!virtualization) {
    body = messages.map((m) => (
      <div key={m.id} data-fc-msg-id={m.id}>
        {renderMessage(m)}
      </div>
    ));
  } else {
    const total = messages.length;
    const start = Math.max(0, Math.floor(scrollTop / rowH) - overscan);
    const end = Math.min(total, Math.ceil((scrollTop + viewportH) / rowH) + overscan);
    const padTop = start * rowH;
    const padBottom = Math.max(0, (total - end) * rowH);

    body = (
      <div style={{ paddingTop: padTop, paddingBottom: padBottom }}>
        {messages.slice(start, end).map((m) => (
          <div key={m.id} data-fc-msg-id={m.id} style={{ minHeight: rowH }}>
            {renderMessage(m)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      onScroll={handleScroll}
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "12px 12px",
        background: "#0b1120",
        ...listStyle,
      }}
    >
      {body}
      {footer}
    </div>
  );
}
