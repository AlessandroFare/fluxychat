import {
  createDlpDetector,
  type DlpAction,
  type DlpContentKind,
  type DlpDetector,
  type DlpResult,
} from "./dlp-detection";

export interface DlpScanContext {
  projectId?: string;
  roomId?: string;
  userId?: string;
  contentId?: string;
}

export interface ExternalDlpAdapter {
  id: string;
  name: string;
  provider: string;
  scanText(text: string, ctx: DlpScanContext): Promise<DlpResult>;
  scanFile?(kind: DlpContentKind, ctx: DlpScanContext): Promise<DlpResult>;
}

export interface UnifiedDlpAdapter {
  scanText(text: string, ctx?: DlpScanContext, policyId?: string): Promise<DlpResult>;
  scanFile(kind: DlpContentKind, ctx?: DlpScanContext, policyId?: string): Promise<DlpResult>;
  registerExternal(adapter: ExternalDlpAdapter): void;
  listExternal(): ExternalDlpAdapter[];
}

function fallbackDlpResult(contentId: string, kind: DlpContentKind, action: DlpAction, text?: string): DlpResult {
  return {
    contentId,
    kind,
    safe: action === "allow" || action === "flag",
    matches: [],
    action,
    redacted: text,
    policyVersion: 0,
  };
}

export function createUnifiedDlpAdapter(localDetector?: DlpDetector): UnifiedDlpAdapter {
  const detector = localDetector ?? createDlpDetector();
  const external: ExternalDlpAdapter[] = [];

  function mergeResults(results: DlpResult[]): DlpResult {
    const blocked = results.find((r) => r.action === "block");
    if (blocked) return blocked;
    const quarantined = results.find((r) => r.action === "quarantine");
    if (quarantined) return quarantined;
    const redacted = results.find((r) => r.action === "redact");
    if (redacted) return redacted;
    return results[0] ?? fallbackDlpResult("empty", "text", "allow");
  }

  return {
    async scanText(text, ctx, policyId) {
      const contentId = ctx?.contentId ?? `text_${Date.now()}`;
      const local = detector.scanText(contentId, text, policyId);
      const remote = await Promise.all(
        external.map((a) => a.scanText(text, { ...ctx, contentId })),
      );
      return mergeResults([local, ...remote]);
    },
    async scanFile(kind, ctx, policyId) {
      const contentId = ctx?.contentId ?? `file_${Date.now()}`;
      const local = detector.scanFile(contentId, kind, policyId);
      const remote = await Promise.all(
        external.filter((a) => a.scanFile).map((a) => a.scanFile!(kind, { ...ctx, contentId })),
      );
      return mergeResults([local, ...remote]);
    },
    registerExternal(adapter) {
      external.push(adapter);
    },
    listExternal() {
      return [...external];
    },
  };
}

/** Worker `/admin/dlp-integrations/scan` compatible fetch adapter. */
export function createWorkerDlpIntegrationAdapter(options: {
  baseUrl: string;
  token: string;
  integrationId: string;
  provider: string;
  name?: string;
}): ExternalDlpAdapter {
  return {
    id: options.integrationId,
    name: options.name ?? options.provider,
    provider: options.provider,
    async scanText(text, ctx) {
      const res = await fetch(`${options.baseUrl.replace(/\/$/, "")}/admin/dlp-integrations/scan`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${options.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          integrationId: options.integrationId,
          text,
          roomId: ctx.roomId,
          userId: ctx.userId,
        }),
      });
      if (!res.ok) {
        return fallbackDlpResult(ctx.contentId ?? "remote", "text", "flag", text);
      }
      return (await res.json()) as DlpResult;
    },
  };
}
