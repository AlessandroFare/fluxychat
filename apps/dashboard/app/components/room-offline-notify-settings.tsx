"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare, Smartphone } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { readJwtSub } from "@/lib/jwt-claims";
import {
  buildSmsPreferencesPatch,
  smsPrefsFromMemberPreferences,
  validateSmsE164,
} from "@/lib/sms-preferences";
import { messageFromUnknown } from "@/lib/error-message";
import { Button, Input, Panel } from "./ui";
import { cn } from "@/lib/utils";

const WORKER_URL = getPublicWorkerUrl();

export interface RoomOfflineNotifySettingsProps {
  roomId: string;
  memberJwt: string;
  /** Defaults to JWT `sub` when omitted. */
  memberUserId?: string;
  className?: string;
  compact?: boolean;
}

export function RoomOfflineNotifySettings({
  roomId,
  memberJwt,
  memberUserId,
  className,
  compact = false,
}: RoomOfflineNotifySettingsProps) {
  const trimmedRoom = roomId.trim();
  const token = memberJwt.trim();
  const userId = memberUserId?.trim() || readJwtSub(token) || "";

  const client = useMemo(() => {
    if (!token || !userId) return null;
    return new FluxyChatClient({
      baseUrl: WORKER_URL,
      userId,
      token,
    });
  }, [token, userId]);

  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [smsE164, setSmsE164] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client || !trimmedRoom || !userId) return;
    setLoading(true);
    setError(null);
    try {
      const members = await client.fetchRoomMembers(trimmedRoom);
      const me = members.find((m) => m.userId === userId);
      if (!me) {
        setError("You are not a member of this room. Join the room first.");
        return;
      }
      setNotifyEnabled(me.notifyEnabled !== false);
      const sms = smsPrefsFromMemberPreferences(me.preferences);
      setSmsE164(sms.smsE164);
      setSmsOptIn(sms.smsOptIn);
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Could not load notification settings"));
    } finally {
      setLoading(false);
    }
  }, [client, trimmedRoom, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!client || !trimmedRoom) return;
    setError(null);
    setNotice(null);
    if (smsOptIn) {
      const validation = validateSmsE164(smsE164);
      if (validation) {
        setError(validation);
        return;
      }
    }
    setSaving(true);
    try {
      await client.updateMemberPreferences(trimmedRoom, {
        notifyEnabled,
        preferences: buildSmsPreferencesPatch(smsE164, smsOptIn),
      });
      setNotice("Notification settings saved.");
    } catch (err: unknown) {
      setError(messageFromUnknown(err, "Failed to save settings"));
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <p className={cn("text-xs text-muted-foreground", className)}>
        Member JWT required to configure SMS alerts for this room.
      </p>
    );
  }

  return (
    <Panel className={cn(compact ? "p-3" : "p-4", className)}>
      <div className="flex items-start gap-2">
        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
            Offline SMS (Sent.dm)
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            When the Worker has <code className="text-[10px]">OFFLINE_SMS_ENABLED</code>, mention
            and DM alerts can text you if you are idle in this room.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Loading…
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={notifyEnabled}
              onChange={(e) => setNotifyEnabled(e.target.checked)}
            />
            In-app notifications for this room
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-border"
              checked={smsOptIn}
              onChange={(e) => setSmsOptIn(e.target.checked)}
            />
            SMS when offline (requires operator Sent.dm setup)
          </label>

          {smsOptIn ? (
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground" htmlFor={`sms-${trimmedRoom}`}>
                Mobile number (E.164)
              </label>
              <Input
                id={`sms-${trimmedRoom}`}
                value={smsE164}
                onChange={(e) => setSmsE164(e.target.value)}
                placeholder="+14155551234"
                autoComplete="tel"
                className="font-mono text-sm"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => void load()} disabled={loading}>
              Reload
            </Button>
          </div>
        </div>
      )}

      {error ? (
        <p className="mt-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-2 text-xs text-brand" role="status">
          {notice}
        </p>
      ) : null}

      <p className="mt-3 flex items-center gap-1 text-[10px] text-muted-foreground">
        <MessageSquare className="h-3 w-3" aria-hidden />
        Member <code className="font-mono">{userId || "—"}</code>
      </p>
    </Panel>
  );
}
