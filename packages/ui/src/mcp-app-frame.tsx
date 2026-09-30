"use client";

import * as React from "react";
import { isAllowedMcpAppMessageOrigin, mcpAppIframeTargetOrigin } from "@fluxy-chat/sdk";

export interface McpAppUiAction {
  name: string;
  payload?: Record<string, unknown>;
}

export interface McpAppFrameProps {
  html: string;
  title?: string;
  /** Origins allowed to post UI actions. Empty = deny all tool calls from the iframe. */
  allowedOrigins?: string[];
  onApproveAction?: (action: McpAppUiAction) => Promise<boolean> | boolean;
  /** Shared JSON for every participant (persist via PUT /rooms/:id/mcp-apps/state). */
  sharedState?: Record<string, unknown>;
  onShareState?: (patch: Record<string, unknown>) => void;
  className?: string;
}

/**
 * Hosts an MCP Apps `ui://` document. UI-initiated tool calls wait for an explicit approve step.
 * State patches from the iframe (`mcp-app-state`) are forwarded after no extra prompt — keep patches small.
 */
export function McpAppFrame({
  html,
  title = "MCP App",
  allowedOrigins = [],
  onApproveAction,
  sharedState,
  onShareState,
  className,
}: McpAppFrameProps) {
  const [pending, setPending] = React.useState<McpAppUiAction | null>(null);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);
  const srcDoc = React.useMemo(() => html, [html]);

  React.useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame || sharedState == null) return;
    const target = mcpAppIframeTargetOrigin(allowedOrigins);
    if (!target) return;
    frame.postMessage({ type: "mcp-app-state", state: sharedState }, target);
  }, [sharedState, allowedOrigins]);

  React.useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!isAllowedMcpAppMessageOrigin(event.origin, allowedOrigins)) return;
      const data = event.data;
      if (data?.type === "mcp-app-state" && data.state && typeof data.state === "object") {
        onShareState?.(data.state as Record<string, unknown>);
        return;
      }
      if (!data || data.type !== "mcp-app-ui-action") return;
      const name = typeof data.name === "string" ? data.name : "";
      if (!name) return;
      setPending({ name, payload: data.payload && typeof data.payload === "object" ? data.payload : {} });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [allowedOrigins, onShareState]);

  async function confirm() {
    if (!pending) return;
    const ok = onApproveAction ? await onApproveAction(pending) : false;
    setPending(null);
    if (!ok) return;
  }

  return (
    <div className={className}>
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        allow=""
        srcDoc={srcDoc}
        className="h-80 w-full rounded-md border border-border bg-background"
        // CSP as a non-standard attribute; sandbox already omits allow-same-origin.
        {...{ csp: "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'" }}
      />
      {pending ? (
        <div
          className="mt-2 rounded-md border border-border p-3 text-sm"
          data-testid="mcp-app-approve"
          role="alertdialog"
          aria-label="Approve MCP App action"
        >
          <p className="font-medium">Approve UI action `{pending.name}`?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => void confirm()}>
              Approve
            </button>
            <button type="button" onClick={() => setPending(null)}>
              Deny
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
