"use client";

import { useCallback, useEffect, useState } from "react";
import { HardDrive, Loader2, Save } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getMediaSettings,
  listMediaJobs,
  updateMediaSettings,
  type MediaJob,
  type MediaSettings,
} from "@/lib/media-pipeline-client";

function formatMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MediaPipelineSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<MediaSettings | null>(null);
  const [jobs, setJobs] = useState<MediaJob[]>([]);
  const [maxMb, setMaxMb] = useState("10");
  const [maxAttachments, setMaxAttachments] = useState("10");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const [settingsRes, jobsRes] = await Promise.all([
        getMediaSettings(token),
        listMediaJobs(token, 30),
      ]);
      setSettings(settingsRes.settings);
      setMaxMb(String((settingsRes.settings.maxFileSizeBytes / (1024 * 1024)).toFixed(1)));
      setMaxAttachments(String(settingsRes.settings.maxAttachmentsPerMessage));
      setJobs(jobsRes.jobs ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load media settings"));
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
    try {
      const maxFileSizeBytes = Math.round(Number(maxMb) * 1024 * 1024);
      const result = await updateMediaSettings(token, {
        maxFileSizeBytes,
        maxAttachmentsPerMessage: Number(maxAttachments),
        avScanEnabled: settings?.avScanEnabled ?? true,
        thumbnailEnabled: settings?.thumbnailEnabled ?? true,
      });
      setSettings(result.settings);
      setNotice("Media settings saved");
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  function toggleFlag(key: "avScanEnabled" | "thumbnailEnabled") {
    if (!settings) return;
    setSettings({ ...settings, [key]: !settings[key] });
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Media pipeline"
        description="Tenant upload limits, async AV scan (EICAR + optional ClamAV HTTP), and image thumbnail jobs on R2."
        icon={HardDrive}
      />

      <ConsoleFeedback error={error} notice={notice} />

      <Section title="Upload limits" description="Applied on POST /upload before files reach R2.">
        <Panel className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </div>
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Max file size (MB)</span>
                  <Input value={maxMb} onChange={(e) => setMaxMb(e.target.value)} type="number" min={0.1} step={0.5} />
                </label>
                <label className="space-y-1 text-sm">
                  <span className="text-muted-foreground">Max attachments per message</span>
                  <Input value={maxAttachments} onChange={(e) => setMaxAttachments(e.target.value)} type="number" min={1} max={20} />
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant={settings?.avScanEnabled ? "default" : "outline"} size="sm" onClick={() => toggleFlag("avScanEnabled")}>
                  AV scan {settings?.avScanEnabled ? "on" : "off"}
                </Button>
                <Button variant={settings?.thumbnailEnabled ? "default" : "outline"} size="sm" onClick={() => toggleFlag("thumbnailEnabled")}>
                  Thumbnails {settings?.thumbnailEnabled ? "on" : "off"}
                </Button>
              </div>
              <Button onClick={() => void handleSave()} disabled={busy}>
                {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save settings
              </Button>
              {settings ? (
                <p className="text-xs text-muted-foreground">
                  Current limit: {formatMb(settings.maxFileSizeBytes)} · {settings.allowedMimeTypes.length} MIME types allowed
                </p>
              ) : null}
            </>
          )}
        </Panel>
      </Section>

      <Section title="Recent scan jobs" description="Messages block attachments while scan_status is pending or infected.">
        <Panel>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No media jobs yet.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {jobs.map((job) => (
                <li key={job.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <div className="truncate font-mono text-xs">{job.fileKey}</div>
                    <div className="text-xs text-muted-foreground">
                      {job.contentType} · {job.sizeBytes ? formatMb(job.sizeBytes) : "—"} · {formatDateTime(job.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={job.scanStatus === "infected" ? "destructive" : "secondary"}>{job.scanStatus}</Badge>
                    <Badge variant="outline">{job.thumbnailStatus}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </Section>
    </ConsoleShell>
  );
}
