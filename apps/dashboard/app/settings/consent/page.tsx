"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { FileCheck2, Loader2, Save } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getConsentSettings,
  listConsentEvents,
  updateConsentSettings,
  type ConsentEventRow,
  type ConsentSettings,
} from "@/lib/consent-dpa-client";

export default function ConsentSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [settings, setSettings] = useState<ConsentSettings | null>(null);
  const [events, setEvents] = useState<ConsentEventRow[]>([]);

  const [enabled, setEnabled] = useState(false);
  const [autoEuOnly, setAutoEuOnly] = useState(true);
  const [dpaVersion, setDpaVersion] = useState("1.0");
  const [bannerTitle, setBannerTitle] = useState("Data processing consent");
  const [bannerBody, setBannerBody] = useState("");
  const [dpaDocumentUrl, setDpaDocumentUrl] = useState("");
  const [requireRoomConsent, setRequireRoomConsent] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [res, ev] = await Promise.all([getConsentSettings(token), listConsentEvents(token, { limit: 30 })]);
      setSettings(res.settings);
      setEvents(ev.events ?? []);
      setEnabled(res.settings.enabled);
      setAutoEuOnly(res.settings.autoEuOnly);
      setDpaVersion(res.settings.dpaVersion);
      setBannerTitle(res.settings.bannerTitle);
      setBannerBody(res.settings.bannerBody);
      setDpaDocumentUrl(res.settings.dpaDocumentUrl ?? "");
      setRequireRoomConsent(res.settings.requireRoomConsent);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load consent settings"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await updateConsentSettings(token, {
        enabled,
        autoEuOnly,
        dpaVersion,
        bannerTitle,
        bannerBody,
        dpaDocumentUrl: dpaDocumentUrl.trim() || null,
        requireRoomConsent,
      });
      setSettings(result.settings);
      setNotice("Consent / DPA policy saved. Bump DPA version to re-prompt members.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save consent policy"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="EU consent &amp; DPA"
        description="Auto consent banner for EU-regulated workspaces. Audit log pairs with data residency settings."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
          ← Settings
        </Link>
        {" · "}
        <Link href="/settings/residency" className="font-medium underline-offset-4 hover:underline">
          Data residency
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Policy">
            <div className="space-y-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
                Enable consent banner
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={autoEuOnly}
                  onChange={(e) => setAutoEuOnly(e.target.checked)}
                  disabled={!enabled}
                />
                Only when project uses EU data regions (auto)
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requireRoomConsent}
                  onChange={(e) => setRequireRoomConsent(e.target.checked)}
                  disabled={!enabled}
                />
                Require consent per room (not project-wide)
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-muted-foreground">DPA version</label>
                  <Input value={dpaVersion} onChange={(e) => setDpaVersion(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-muted-foreground">DPA document URL</label>
                  <Input
                    value={dpaDocumentUrl}
                    onChange={(e) => setDpaDocumentUrl(e.target.value)}
                    placeholder="https://…/dpa.pdf"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground">Banner title</label>
                <Input value={bannerTitle} onChange={(e) => setBannerTitle(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-muted-foreground">Banner body</label>
                <textarea
                  className="min-h-[88px] w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={bannerBody}
                  onChange={(e) => setBannerBody(e.target.value)}
                />
              </div>
              {settings?.updatedAt ? (
                <p className="text-xs text-muted-foreground">
                  Last updated {formatDateTime(settings.updatedAt)}
                </p>
              ) : null}
              <Button size="sm" disabled={busy} onClick={() => void handleSave()}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save policy
              </Button>
            </div>
          </Section>

          <Section title="Consent audit log">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground">No consent events yet.</p>
            ) : (
              <ul className="divide-y rounded-lg border border-border text-sm">
                {events.map((ev) => (
                  <li key={ev.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                    <Badge variant={ev.eventType === "accepted" ? "default" : "secondary"}>
                      {ev.eventType}
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">{ev.userId}</span>
                    {ev.roomId ? (
                      <span className="text-xs text-muted-foreground">room {ev.roomId}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">DPA v{ev.dpaVersion}</span>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatDateTime(ev.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}
    </ConsoleShell>
  );
}
