"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Loader2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Banner, Button, EmptyState, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import { listPushConfigs, upsertPushConfig, type PushConfigSummary } from "@/lib/competitor-parity-client";

export default function PushSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [configs, setConfigs] = useState<PushConfigSummary[]>([]);
  const [environment, setEnvironment] = useState("production");
  const [apnsBundleId, setApnsBundleId] = useState("");
  const [apnsUseSandbox, setApnsUseSandbox] = useState(false);
  const [fcmServerKey, setFcmServerKey] = useState("");
  const [fcmProjectId, setFcmProjectId] = useState("");
  const [fcmServiceAccountJson, setFcmServiceAccountJson] = useState("");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listPushConfigs(token);
      setConfigs(data.configs);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load push config"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await upsertPushConfig(token, {
        environment,
        apnsBundleId: apnsBundleId.trim() || undefined,
        apnsUseSandbox,
        webPushEnabled: true,
        fcmServerKey: fcmServerKey.trim() || undefined,
        fcmProjectId: fcmProjectId.trim() || undefined,
        fcmServiceAccountJson: fcmServiceAccountJson.trim() || undefined,
      });
      setNotice("Push configuration saved.");
      setFcmServerKey("");
      setFcmServiceAccountJson("");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save push config"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Push notifications"
        description="Per-environment FCM, APNs, and Web Push settings."
        icon={BellRing}
      />
      <ConsoleFeedback error={error} notice={notice} />
      <Section title="Push configuration">
        <Panel className="space-y-4 p-4">
          {loading ? (
            <div className="flex items-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : configs.length === 0 ? (
            <EmptyState
              title="No push config yet"
              description="Configure APNs bundle ID and environment below. FCM/APNs secrets are stored per project."
            />
          ) : (
            <ul className="space-y-2">
              {configs.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <Badge variant="outline">{c.environment}</Badge>
                  {c.hasFcm ? <Badge>FCM</Badge> : null}
                  {c.hasApns ? <Badge>APNs</Badge> : null}
                  {c.webPushEnabled ? <Badge variant="secondary">Web Push</Badge> : null}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Updated {formatDateTime(c.updatedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block font-medium">Environment</span>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={environment}
                onChange={(e) => setEnvironment(e.target.value)}
              >
                <option value="development">development</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">APNs bundle ID</span>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={apnsBundleId}
                onChange={(e) => setApnsBundleId(e.target.value)}
                placeholder="com.example.app"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium">FCM project ID</span>
              <input
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={fcmProjectId}
                onChange={(e) => setFcmProjectId(e.target.value)}
                placeholder="my-firebase-project"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">FCM legacy server key (optional)</span>
              <input
                type="password"
                autoComplete="off"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={fcmServerKey}
                onChange={(e) => setFcmServerKey(e.target.value)}
                placeholder="Leave blank to keep existing"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium">FCM HTTP v1 service account JSON</span>
              <textarea
                className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
                value={fcmServiceAccountJson}
                onChange={(e) => setFcmServiceAccountJson(e.target.value)}
                placeholder='{"type":"service_account","project_id":"..."}'
              />
              <span className="mt-1 block text-xs text-muted-foreground">
                Used when legacy server key is absent. Stored encrypted per project/environment.
              </span>
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={apnsUseSandbox}
              onChange={(e) => setApnsUseSandbox(e.target.checked)}
            />
            Use APNs sandbox (dev builds)
          </label>
          <Button type="button" disabled={busy || !token} onClick={() => void save()}>
            {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Save push config
          </Button>
        </Panel>
      </Section>
      {!token ? <Banner variant="warning">Admin JWT required.</Banner> : null}
    </ConsoleShell>
  );
}
