"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { Button, Input, Section } from "./ui";
import {
  chainToJson,
  defaultApprovalChain,
  fetchHitlSlackUserMap,
  fetchRoomConfig,
  parseChainJson,
  patchRoomConfig,
  putHitlSlackUserMap,
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
  const [skipTwoKey, setSkipTwoKey] = useState(false);
  const [nlPolicy, setNlPolicy] = useState("");
  const [slackUserId, setSlackUserId] = useState("");
  const [slackNotice, setSlackNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!memberJwt.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRoomConfig(memberJwt, roomId);
      const chain = data.config?.approvalChain ?? defaultApprovalChain();
      setChainJson(chainToJson(chain));
      setUpdatedAt(data.updatedAt);
      setSkipTwoKey(data.config?.sharedRoomTwoKey === false);
      setNlPolicy(typeof data.config?.nlPolicy === "string" ? data.config.nlPolicy : "");
      const maps = await fetchHitlSlackUserMap(memberJwt).catch(() => []);
      const mine = maps[0];
      if (mine?.slackUserId) setSlackUserId(mine.slackUserId);
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

  async function saveTwoKey() {
    if (!memberJwt.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await patchRoomConfig(memberJwt, roomId, {
        sharedRoomTwoKey: skipTwoKey ? false : null,
      });
      setUpdatedAt(data.updatedAt);
      setNotice(
        skipTwoKey
          ? "Two-key HITL skipped for this room. Worker SHARED_ROOM_TWO_KEY no longer applies here."
          : "This room inherits Worker SHARED_ROOM_TWO_KEY (default on).",
      );
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save two-key setting"));
    } finally {
      setSaving(false);
    }
  }

  async function saveNlPolicy() {
    if (!memberJwt.trim()) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await patchRoomConfig(memberJwt, roomId, {
        nlPolicy: nlPolicy.trim() ? nlPolicy.trim().slice(0, 500) : null,
      });
      setUpdatedAt(data.updatedAt);
      setNotice("Room policy saved. Agent replies are scored in ROOM_NL_POLICY_MODE (default shadow).");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save room policy"));
    } finally {
      setSaving(false);
    }
  }

  async function saveSlackMap() {
    if (!memberJwt.trim() || !slackUserId.trim()) return;
    setSaving(true);
    setError(null);
    setSlackNotice(null);
    try {
      await putHitlSlackUserMap(memberJwt, slackUserId.trim());
      setSlackNotice("Slack user id saved. Mapped HITL buttons omit the tap token.");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save Slack mapping"));
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

      <p className="mt-4 text-xs font-medium">Shared-room two-key HITL</p>
      <p className="text-xs text-muted-foreground">
        Worker default is on (<code className="text-[10px]">SHARED_ROOM_TWO_KEY</code>). Guests plus private context plus outbound tools wait on this chain.
        Check below only for a locked private-room experiment.
      </p>
      <label className="mt-2 flex items-start gap-2 text-xs">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={skipTwoKey}
          onChange={(e) => setSkipTwoKey(e.target.checked)}
        />
        <span>Skip two-key HITL in this room (inherit env when unchecked)</span>
      </label>
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={saving || loading} onClick={() => void saveTwoKey()}>
        Save two-key setting
      </Button>

      <p className="mt-4 text-xs font-medium">Natural-language room policy</p>
      <p className="text-xs text-muted-foreground">
        Operator text only (max 500). System One scores agent replies against it. Default is shadow (log only).
        <code className="text-[10px]">ROOM_NL_POLICY_MODE=enforce</code> rewrites blocked replies. Does not delete human messages.
      </p>
      <textarea
        className="mt-2 min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-xs"
        maxLength={500}
        value={nlPolicy}
        onChange={(e) => setNlPolicy(e.target.value)}
        placeholder="No medical advice. Flag deals over 10000 EUR."
      />
      <Button type="button" size="sm" variant="outline" className="mt-2" disabled={saving || loading} onClick={() => void saveNlPolicy()}>
        Save room policy
      </Button>

      <p className="mt-4 text-xs font-medium">Slack user map (this project)</p>
      <p className="text-xs text-muted-foreground">
        Profile → copy member ID in Slack. When this id is saved, interactive HITL buttons send the approval id only.
        Email links still use HMAC. Unmapped clicks still carry the tap token.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Input
          className="h-8 w-44 text-xs"
          placeholder="U01234567"
          value={slackUserId}
          onChange={(e) => setSlackUserId(e.target.value)}
        />
        <Button type="button" size="sm" variant="outline" disabled={saving || loading} onClick={() => void saveSlackMap()}>
          Save Slack id
        </Button>
      </div>
      {slackNotice ? <p className="mt-2 text-xs text-muted-foreground">{slackNotice}</p> : null}
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </Section>
  );
}
