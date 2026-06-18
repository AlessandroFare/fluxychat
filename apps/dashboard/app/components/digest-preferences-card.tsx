"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Banner, Button, Panel } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { messageFromUnknown } from "@/lib/error-message";

interface DigestPreferencesCardProps {
  token: string;
  className?: string;
}

export function DigestPreferencesCard({ token, className }: DigestPreferencesCardProps) {
  const client = useMemo(
    () =>
      new FluxyChatClient({
        baseUrl: getPublicWorkerUrl(),
        userId: "console",
        token,
      }),
    [token],
  );

  const [enabled, setEnabled] = useState(false);
  const [email, setEmail] = useState("");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [webPushEnabled, setWebPushEnabled] = useState(true);
  const [inAppEnabled, setInAppEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void client
      .getDigestPreferences()
      .then((prefs) => {
        if (cancelled || !prefs) return;
        setEnabled(prefs.enabled);
        setEmail(prefs.email ?? "");
        setEmailEnabled(prefs.emailEnabled);
        setWebPushEnabled(prefs.webPushEnabled);
        setInAppEnabled(prefs.inAppEnabled);
      })
      .catch((err) => {
        if (!cancelled) setError(messageFromUnknown(err, "Failed to load digest settings"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await client.updateDigestPreferences({
        enabled,
        email: email.trim() || null,
        emailEnabled,
        webPushEnabled,
        inAppEnabled,
      });
      setNotice("Digest preferences saved.");
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setSaving(false);
    }
  }, [client, enabled, email, emailEnabled, webPushEnabled, inAppEnabled]);

  return (
    <Panel className={className ?? "mb-6 p-4"}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Daily AI digest</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Every day at 08:00 UTC, get three AI highlights from yesterday across your rooms — in-app,
        web push, and optional email.
      </p>

      {error ? <Banner variant="error">{error}</Banner> : null}
      {notice ? <Banner variant="success">{notice}</Banner> : null}

      <div className="mt-4 space-y-3 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            disabled={loading || saving}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Enable daily digest
        </label>

        <label className="block">
          <span className="text-xs text-muted-foreground">Email (optional)</span>
          <input
            type="email"
            className="mt-1 w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
            placeholder="you@company.com"
            value={email}
            disabled={loading || saving || !enabled}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={inAppEnabled}
              disabled={loading || saving || !enabled}
              onChange={(e) => setInAppEnabled(e.target.checked)}
            />
            In-app
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={webPushEnabled}
              disabled={loading || saving || !enabled}
              onChange={(e) => setWebPushEnabled(e.target.checked)}
            />
            Web push
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={emailEnabled}
              disabled={loading || saving || !enabled || !email.trim()}
              onChange={(e) => setEmailEnabled(e.target.checked)}
            />
            Email
          </label>
        </div>
      </div>

      <Button
        type="button"
        size="sm"
        className="mt-4"
        disabled={loading || saving}
        onClick={() => void onSave()}
      >
        {saving ? "Saving…" : "Save digest settings"}
      </Button>
    </Panel>
  );
}

