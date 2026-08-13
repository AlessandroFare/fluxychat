"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { Button, Section } from "./ui";
import {
  chainToJson,
  defaultApprovalChain,
  fetchRoomConfig,
  parseChainJson,
  patchRoomConfig,
  type ApprovalChainConfig,
} from "@/lib/hitl-approval-client";
import { messageFromUnknown } from "@/lib/error-message";

interface RoomApprovalChainPanelProps {
  roomId: string;
  memberJwt: string;
}

export function RoomApprovalChainPanel({ roomId, memberJwt }: RoomApprovalChainPanelProps) {
  const [chainJson, setChainJson] = useState(() => chainToJson(defaultApprovalChain()));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoomConfig(memberJwt, roomId);
      const chain = data.config?.approvalChain ?? defaultApprovalChain();
      setChainJson(chainToJson(chain));
      setUpdatedAt(data.updatedAt);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room config"));
    } finally {
      setLoading(false);
    }
  }, [memberJwt, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!memberJwt.trim()) return;
    const parsed = parseChainJson(chainJson);
    if (!parsed) {
      setError("Invalid JSON. Expected { steps: [...], defaultTimeoutSeconds?: number }");
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await patchRoomConfig(memberJwt, roomId, { approvalChain: parsed });
      setUpdatedAt(data.updatedAt);
      setNotice("Approval chain saved. Changes are audited on the room timeline.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save approval chain"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section
      title="HITL approval chain"
      description="Configurable approver steps per room. Pending requests snapshot the chain at creation time."
    >
      <p className="text-xs text-muted-foreground">
        Stored in room config (same mechanism as other room settings). Each step can set{" "}
        <code className="text-[10px]">approverId</code> + <code className="text-[10px]">timeoutSeconds</code>, or a final{" "}
        <code className="text-[10px]">fallback</code>.
      </p>
      <textarea
        className="mt-3 min-h-[140px] w-full rounded-md border bg-background px-3 py-2 font-mono text-xs"
        value={chainJson}
        onChange={(e) => setChainJson(e.target.value)}
        spellCheck={false}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={saving || loading} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
          Save chain
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => setChainJson(chainToJson(defaultApprovalChain()))}
        >
          <Shield className="mr-1.5 h-3.5 w-3.5" />
          Reset template
        </Button>
      </div>
      {updatedAt ? (
        <p className="mt-2 text-[10px] text-muted-foreground">Last updated {new Date(updatedAt).toLocaleString()}</p>
      ) : null}
      {notice ? <p className="mt-2 text-xs text-muted-foreground">{notice}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
