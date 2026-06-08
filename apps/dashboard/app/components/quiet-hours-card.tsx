"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Moon } from "lucide-react";
import { FluxyChatClient } from "@fluxy-chat/sdk";
import { Banner, Button, Panel } from "./ui";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";

interface QuietHoursCardProps {
  token: string;
  className?: string;
}

const TIMEZONES = [
  "UTC",
  "Europe/Rome",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Australia/Sydney",
];

export function QuietHoursCard({ token, className }: QuietHoursCardProps) {
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
  const [timezone, setTimezone] = useState("UTC");
  const [quietStart, setQuietStart] = useState("22:00");
  const [quietEnd, setQuietEnd] = useState("07:00");
  const [batchPush, setBatchPush] = useState(true);
  const [batchInApp, setBatchInApp] = useState(true);
  const [pendingBatch, setPendingBatch] = useState(0);
  const [inQuietHours, setInQuietHours] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getQuietHoursPreferences();
      if (!data) return;
      const prefs = data.preferences;
      setEnabled(prefs.enabled);
      setTimezone(prefs.timezone);
      setQuietStart(prefs.quietStart);
      setQuietEnd(prefs.quietEnd);
      setBatchPush(prefs.batchPush);
      setBatchInApp(prefs.batchInApp);
      setPendingBatch(data.pendingBatch);
      setInQuietHours(data.inQuietHours);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiet hours");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await client.updateQuietHoursPreferences({
        enabled,
        timezone,
        quietStart,
        quietEnd,
        batchPush,
        batchInApp,
      });
      if (data) {
        setPendingBatch(data.pendingBatch);
        setInQuietHours(data.inQuietHours);
      }
      setNotice("Quiet hours saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [client, enabled, timezone, quietStart, quietEnd, batchPush, batchInApp]);

  async function onFlush() {
    setError(null);
    try {
      const result = await client.flushNotificationBatch();
      setPendingBatch(0);
      setNotice(`Flushed ${result?.flushed ?? 0} batched notifications.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Flush failed");
    }
  }

  return (
    <Panel className={className ?? "mb-6 p-4"}>
      <div className="flex items-center gap-2">
        <Moon className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">Quiet hours</h2>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        During quiet hours, push and in-app alerts are batched and delivered when the window ends
        (cron every 15 min) or when you open notifications.
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
          Enable quiet hours
        </label>

        {enabled ? (
          <p className="text-xs text-muted-foreground">
            Status: {inQuietHours ? "quiet period active" : "delivering normally"}
            {pendingBatch > 0 ? ` · ${pendingBatch} batched` : ""}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-muted-foreground">Timezone</span>
            <select
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={timezone}
              disabled={loading || saving || !enabled}
              onChange={(e) => setTimezone(e.target.value)}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Quiet start</span>
            <input
              type="time"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={quietStart}
              disabled={loading || saving || !enabled}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs text-muted-foreground">Quiet end</span>
            <input
              type="time"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              value={quietEnd}
              disabled={loading || saving || !enabled}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={batchPush}
              disabled={loading || saving || !enabled}
              onChange={(e) => setBatchPush(e.target.checked)}
            />
            Batch push
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={batchInApp}
              disabled={loading || saving || !enabled}
              onChange={(e) => setBatchInApp(e.target.checked)}
            />
            Batch in-app
          </label>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={loading || saving} onClick={() => void onSave()}>
          {saving ? "Saving…" : "Save quiet hours"}
        </Button>
        {pendingBatch > 0 && !inQuietHours ? (
          <Button type="button" size="sm" variant="outline" onClick={() => void onFlush()}>
            Flush batch now
          </Button>
        ) : null}
      </div>
    </Panel>
  );
}
