"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useDashboardSession } from "@/app/components/dashboard-session";
import { fetchWorkerJson } from "@/lib/worker-fetch";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

interface HitlApproval {
  id: string;
  toolName: string;
  toolInput?: unknown;
  roomId?: string;
  status: string;
}

interface ToolApprovalPanelProps {
  roomId: string;
  enabled?: boolean;
}

export function ToolApprovalPanel({ roomId, enabled = true }: ToolApprovalPanelProps) {
  const { adminJwt, memberJwt } = useDashboardSession();
  const token = (adminJwt || memberJwt).trim();
  const [pending, setPending] = useState<HitlApproval[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const disabledRef = useRef(false);

  const load = useCallback(async () => {
    if (!enabled || disabledRef.current || !token || !roomId) return;
    try {
      const body = await fetchWorkerJson<{ approvals?: HitlApproval[] }>(
        `${getPublicWorkerUrl()}/api/hitl/approvals?roomId=${encodeURIComponent(roomId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setPending(body.approvals ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("kv_not_configured") || message.includes("(503)")) {
        disabledRef.current = true;
      }
      setPending([]);
    }
  }, [enabled, token, roomId]);

  useEffect(() => {
    if (!enabled) {
      setPending([]);
      return;
    }
    disabledRef.current = false;
    void load();
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [enabled, load]);

  async function decide(id: string, action: "approve" | "deny") {
    if (!token) return;
    setBusy(id);
    try {
      await fetchWorkerJson(`${getPublicWorkerUrl()}/api/hitl/approvals/${encodeURIComponent(id)}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!enabled || pending.length === 0) return null;

  return (
    <div className="mx-4 mb-2 space-y-2 rounded-lg border border-amber-300/60 bg-amber-50/80 p-3">
      <p className="text-xs font-semibold text-amber-900">Tool approvals pending</p>
      {pending.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-2 text-xs">
          <code className="font-semibold">{a.toolName}</code>
          <Button size="sm" variant="default" disabled={busy === a.id} onClick={() => void decide(a.id, "approve")}>
            {busy === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Approve
          </Button>
          <Button size="sm" variant="outline" disabled={busy === a.id} onClick={() => void decide(a.id, "deny")}>
            <X className="h-3 w-3" /> Deny
          </Button>
        </div>
      ))}
    </div>
  );
}
