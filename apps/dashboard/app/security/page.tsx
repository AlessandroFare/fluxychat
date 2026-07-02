"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Webhook,
  Fingerprint,
  Cookie,
  FileKey,
  XCircle,
} from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { Panel } from "~/components/ui/Panel";
import { Button } from "~/components/ui/button";
import { useDashboardSession } from "../components/dashboard-session";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/*  Types & data                                                              */
/* -------------------------------------------------------------------------- */

interface SecurityCheck {
  id: string;
  label: string;
  description: string;
  status: "pass" | "warn" | "fail" | "unknown";
  detail?: string;
}

interface TokenInfo {
  encrypted: boolean;
  algorithm?: string;
  keyId?: string;
  expiresAt?: string;
  provider?: string;
}

interface AdapterErrorNode {
  name: string;
  description: string;
  children?: AdapterErrorNode[];
}

const ERROR_TREE: AdapterErrorNode = {
  name: "AdapterError",
  description: "Base class for all adapter errors. Extends Error.",
  children: [
    {
      name: "AdapterConnectionError",
      description: "Failed to connect to the platform (network, auth, rate limit).",
      children: [
        {
          name: "AdapterAuthError",
          description: "Invalid or expired credentials.",
          children: [
            { name: "AdapterTokenExpiredError", description: "OAuth token expired and refresh failed." },
            { name: "AdapterInvalidCredentialsError", description: "API key or secret is invalid." },
          ],
        },
        {
          name: "AdapterRateLimitError",
          description: "Platform rate limit exceeded. Includes retryAfter.",
        },
      ],
    },
    {
      name: "AdapterMessageError",
      description: "Error during message send/receive.",
      children: [
        { name: "AdapterMessageTooLargeError", description: "Message exceeds platform size limit." },
        { name: "AdapterUnsupportedMessageError", description: "Message type not supported by adapter." },
        { name: "AdapterDeliveryError", description: "Platform rejected the message." },
      ],
    },
    {
      name: "AdapterWebhookError",
      description: "Webhook validation or delivery failure.",
      children: [
        { name: "AdapterWebhookSignatureError", description: "Webhook signature verification failed." },
        { name: "AdapterWebhookTimeoutError", description: "Webhook response timed out." },
      ],
    },
    {
      name: "AdapterConfigurationError",
      description: "Missing or invalid adapter configuration.",
    },
  ],
};

const SECURITY_GUIDES = [
  { href: "/guides/jwt-auth", label: "JWT Authentication", description: "How to configure JWT-based auth for self-hosted deployments." },
  { href: "/guides/webhook-signing", label: "Webhook Signing", description: "Verify webhook payloads with HMAC signatures." },
  { href: "/guides/api-key-management", label: "API Key Management", description: "Rotate, scope, and revoke API keys safely." },
  { href: "/guides/session-security", label: "Session Security", description: "Best practices for session storage and token refresh." },
  { href: "/guides/oauth-encryption", label: "OAuth Token Encryption", description: "Encrypt stored OAuth tokens at rest." },
  { href: "/guides/gdpr-compliance", label: "GDPR & Data Retention", description: "Export, anonymize, and delete user data." },
] as const;

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function SecurityPage() {
  const { adminJwt, memberJwt } = useDashboardSession();
  const workerUrl = getPublicWorkerUrl();

  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loadingToken, setLoadingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [showTokenDetails, setShowTokenDetails] = useState(false);

  const authHeader = useMemo(() => {
    const token = adminJwt.trim() || memberJwt.trim();
    return token ? { Authorization: `Bearer ${token}` } : undefined;
  }, [adminJwt, memberJwt]);

  const fetchTokenInfo = useCallback(async () => {
    setLoadingToken(true);
    setTokenError(null);
    try {
      const res = await fetch(`${workerUrl}/api/security/tokens`, {
        headers: authHeader,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as TokenInfo;
      setTokenInfo(data);
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Failed to load token info");
      setTokenInfo(null);
    } finally {
      setLoadingToken(false);
    }
  }, [workerUrl, authHeader]);

  useEffect(() => {
    void fetchTokenInfo();
  }, [fetchTokenInfo]);

  // Security checklist — combines static checks with dynamic token info
  const checklist: SecurityCheck[] = useMemo(() => {
    const items: SecurityCheck[] = [
      {
        id: "jwt",
        label: "JWT Authentication",
        description: "Admin or member JWT is present in session storage.",
        status: adminJwt.trim() || memberJwt.trim() ? "pass" : "fail",
        detail: adminJwt.trim()
          ? "Admin JWT detected."
          : memberJwt.trim()
            ? "Member JWT detected."
            : "No JWT found. Configure auth to enable API access.",
      },
      {
        id: "webhook",
        label: "Webhook Signing",
        description: "Webhooks are signed with HMAC for payload verification.",
        status: "unknown",
        detail: "Verify your adapter configuration includes a webhook secret.",
      },
      {
        id: "apikey",
        label: "API Key Hashing",
        description: "API keys are hashed (SHA-256) before storage.",
        status: "pass",
        detail: "All API keys are hashed server-side. Raw keys are only shown once at creation.",
      },
      {
        id: "session",
        label: "Session Storage",
        description: "JWT tokens stored in sessionStorage (cleared on tab close).",
        status: "pass",
        detail: "Tokens use sessionStorage, not localStorage — cleared when the browser tab closes.",
      },
      {
        id: "oauth",
        label: "OAuth Token Encryption",
        description: "Stored OAuth tokens are encrypted at rest.",
        status: tokenInfo?.encrypted === true ? "pass" : tokenInfo?.encrypted === false ? "warn" : "unknown",
        detail: tokenInfo?.encrypted
          ? `Encrypted with ${tokenInfo.algorithm ?? "AES-256-GCM"}`
          : tokenInfo
            ? "Tokens are stored but NOT encrypted. Enable encryption in production."
            : "No token information available.",
      },
      {
        id: "cors",
        label: "CORS Configuration",
        description: "Cross-origin requests are restricted to known domains.",
        status: "unknown",
        detail: "Check your Worker CORS configuration to ensure only trusted origins are allowed.",
      },
    ];
    return items;
  }, [adminJwt, memberJwt, tokenInfo]);

  const passCount = checklist.filter((c) => c.status === "pass").length;
  const warnCount = checklist.filter((c) => c.status === "warn").length;
  const failCount = checklist.filter((c) => c.status === "fail").length;
  const unknownCount = checklist.filter((c) => c.status === "unknown").length;

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Security & Encryption"
        description={
          <>
            Inspect your adapter error hierarchy, token encryption status, and security checklist.
            Keep your deployment secure with best practices.{" "}
            <Link href="/guides/jwt-auth" className="text-brand underline underline-offset-2">
              Learn more →
            </Link>
          </>
        }
      />

      {/* Summary banner */}
      <div
        className={cn(
          "mb-6 flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between",
          failCount > 0
            ? "border-red-200 bg-red-50"
            : warnCount > 0
              ? "border-amber-200 bg-amber-50"
              : "border-emerald-200 bg-emerald-50",
        )}
      >
        <div className="flex items-center gap-3">
          {failCount > 0 ? (
            <ShieldAlert className="h-6 w-6 text-red-600" />
          ) : warnCount > 0 ? (
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          ) : (
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {failCount > 0
                ? "Security issues detected"
                : warnCount > 0
                  ? "Some checks need attention"
                  : "All checks passing"}
            </p>
            <p className="text-xs text-muted-foreground">
              {passCount} passed · {warnCount} warnings · {failCount} failed · {unknownCount} unknown
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => void fetchTokenInfo()} disabled={loadingToken}>
          {loadingToken ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Left column: Error tree + Checklist */}
        <div className="min-w-0 space-y-6">
          {/* Adapter error hierarchy */}
          <Panel title="Adapter error hierarchy">
            <p className="mb-3 text-xs text-muted-foreground">
              All adapter errors extend <code className="font-mono">AdapterError</code>. Use typed
              catch blocks to handle specific failure modes.
            </p>
            <div className="overflow-x-auto">
              <ErrorTree node={ERROR_TREE} depth={0} />
            </div>
          </Panel>

          {/* Security checklist */}
          <Panel title="Security checklist">
            <div className="space-y-2">
              {checklist.map((item) => (
                <ChecklistRow key={item.id} item={item} />
              ))}
            </div>
          </Panel>
        </div>

        {/* Right column: Token encryption + Guides */}
        <div className="min-w-0 space-y-6">
          {/* Token encryption status */}
          <Panel title="Token encryption status">
            {tokenError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {tokenError}
              </div>
            ) : loadingToken ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading token info…
              </div>
            ) : tokenInfo ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {tokenInfo.encrypted ? (
                    <Lock className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Lock className="h-4 w-4 text-amber-600" />
                  )}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      tokenInfo.encrypted ? "text-emerald-700" : "text-amber-700",
                    )}
                  >
                    {tokenInfo.encrypted ? "Tokens are encrypted at rest" : "Tokens are NOT encrypted"}
                  </span>
                </div>

                <button
                  onClick={() => setShowTokenDetails((v) => !v)}
                  className="flex items-center gap-1 text-xs text-brand underline underline-offset-2"
                >
                  {showTokenDetails ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showTokenDetails ? "Hide details" : "Show details"}
                </button>

                {showTokenDetails ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
                    <TokenDetail label="Algorithm" value={tokenInfo.algorithm ?? "—"} icon={Key} />
                    <TokenDetail label="Key ID" value={tokenInfo.keyId ?? "—"} icon={Fingerprint} />
                    <TokenDetail label="Provider" value={tokenInfo.provider ?? "—"} icon={Shield} />
                    <TokenDetail
                      label="Expires"
                      value={tokenInfo.expiresAt ? new Date(tokenInfo.expiresAt).toLocaleString() : "—"}
                      icon={FileKey}
                    />
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                No token information available. Configure OAuth in your adapter settings.
              </div>
            )}
          </Panel>

          {/* Security guides */}
          <Panel title="Security guides">
            <div className="space-y-2">
              {SECURITY_GUIDES.map((guide) => (
                <Link
                  key={guide.href}
                  href={guide.href}
                  className="block rounded-lg border border-border bg-muted/20 p-3 transition-colors hover:border-brand/30 hover:bg-brand/5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{guide.label}</span>
                    <span className="text-xs text-brand">→</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{guide.description}</p>
                </Link>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </ConsoleShell>
  );
}

/* -------------------------------------------------------------------------- */
/*  Error Tree                                                                */
/* -------------------------------------------------------------------------- */

function ErrorTree({ node, depth }: { node: AdapterErrorNode; depth: number }) {
  return (
    <div style={{ paddingLeft: depth > 0 ? `${depth * 16}px` : undefined }}>
      <div
        className={cn(
          "flex items-start gap-2 rounded-md py-1.5",
          depth === 0 && "font-mono font-semibold text-foreground",
          depth > 0 && "text-foreground",
        )}
      >
        {depth > 0 ? (
          <span className="mt-0.5 text-muted-foreground">├─</span>
        ) : (
          <Shield className="mt-0.5 h-3.5 w-3.5 text-brand" />
        )}
        <div>
          <code
            className={cn(
              "font-mono text-xs",
              depth === 0 ? "font-bold text-foreground" : "text-blue-600 dark:text-blue-400",
            )}
          >
            {node.name}
          </code>
          <p className="text-xs text-muted-foreground">{node.description}</p>
        </div>
      </div>
      {node.children?.map((child, idx) => (
        <ErrorTree key={idx} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Checklist Row                                                             */
/* -------------------------------------------------------------------------- */

function ChecklistRow({ item }: { item: SecurityCheck }) {
  const config = {
    pass: { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    warn: { icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
    fail: { icon: XCircle, color: "text-red-600", bg: "bg-red-50" },
    unknown: { icon: Eye, color: "text-slate-400", bg: "bg-muted/40" },
  };
  const c = config[item.status];
  const Icon = c.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-lg border border-border p-3", c.bg)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", c.color)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{item.label}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
              c.bg,
              c.color,
            )}
          >
            {item.status}
          </span>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
        {item.detail ? (
          <p className={cn("mt-1 text-xs", c.color)}>{item.detail}</p>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Token Detail                                                              */
/* -------------------------------------------------------------------------- */

function TokenDetail({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof Key;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      <code className="font-mono text-xs text-foreground">{value}</code>
    </div>
  );
}
