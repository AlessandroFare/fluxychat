"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useDashboardSession } from "../components/dashboard-session";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { RoomPicker } from "../components/room-picker";
import { ConfirmDialog } from "../components/confirm-dialog";
import {
  Banner,
  Button,
  Input,
  Section,
  Textarea,
} from "../components/ui";
import {
  consoleDarkCardClass,
  consoleDarkCardMutedClass,
  consoleDarkCodeClass,
} from "@/lib/console-dark-surface";

import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const WORKER_URL = getPublicWorkerUrl();

type AdminAction = "mute" | "unmute" | "ban" | "unban";

interface Report {
  id: number;
  project_id: string;
  room_id: string;
  user_id: string;
  action: string;
  reason?: string;
  target_message_id?: number;
  created_at: string;
}

interface AuditEvent {
  id: string;
  action: string;
  actor_user_id: string;
  target_type?: string | null;
  target_id?: string | null;
  created_at: string;
}

interface WebhookRow {
  id: string;
  project_id: string;
  url: string;
  event_types: string;
  created_at: string;
}

async function callAdminEndpoint(
  action: AdminAction,
  body: Record<string, unknown>,
  jwt: string
) {
  return fetchWorkerJson<Record<string, unknown>>(`${WORKER_URL}/admin/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify(body),
  });
}

export default function AdminPage() {
  const { adminJwt, memberJwt, activeProject } = useDashboardSession();
  const sessionToken = (adminJwt || memberJwt).trim();
  const [roomId, setRoomId] = useState("");
  const [userId, setUserId] = useState("");
  const [duration, setDuration] = useState(300);
  const [log, setLog] = useState<string[]>([]);
  const [announcement, setAnnouncement] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState(
    "message.created,report.created,moderation.auto_flag"
  );
  const [webhookSecret, setWebhookSecret] = useState("");
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [webhookRows, setWebhookRows] = useState<WebhookRow[]>([]);
  const [webhookListLoading, setWebhookListLoading] = useState(false);

  const loadWebhooks = useCallback(async () => {
    if (!adminJwt.trim()) return;
    setWebhookListLoading(true);
    try {
      const json = await fetchWorkerJson<{ webhooks?: WebhookRow[] }>(
        `${WORKER_URL}/admin/webhooks`,
        {
          headers: { Authorization: `Bearer ${adminJwt.trim()}` },
        }
      );
      setWebhookRows(json.webhooks || []);
    } catch (err: unknown) {
      setLog((logs) => [
        messageFromUnknown(err, "Webhook list failed"),
        ...logs,
      ]);
    } finally {
      setWebhookListLoading(false);
    }
  }, [adminJwt]);

  useEffect(() => {
    if (adminJwt.trim()) void loadWebhooks();
  }, [adminJwt, loadWebhooks]);

  const runAction = async (action: AdminAction) => {
    if (!adminJwt.trim()) {
      setLog((logs) => ["Admin JWT required", ...logs]);
      return;
    }
    if (!roomId || !userId) {
      setLog((logs) => ["roomId and userId required", ...logs]);
      return;
    }
    try {
      setNotice(null);
      const payload: Record<string, unknown> = { roomId, userId };
      if (action === "mute") payload.durationSeconds = duration;
      await callAdminEndpoint(action, payload, adminJwt.trim());
      setLog((logs) => [`${action.toUpperCase()} succeeded`, ...logs]);
      setNotice(`${action.toUpperCase()} succeeded.`);
    } catch (err: unknown) {
      setLog((logs) => [
        messageFromUnknown(err, "Unknown error"),
        ...logs,
      ]);
    }
  };

  const loadReports = async () => {
    if (!adminJwt.trim()) {
      setLog((logs) => ["Admin JWT required", ...logs]);
      return;
    }
    setLoadingReports(true);
    try {
      setNotice(null);
      const json = await fetchWorkerJson<{ reports?: Report[] }>(`${WORKER_URL}/admin/reports`, {
        headers: {
          Authorization: `Bearer ${adminJwt.trim()}`,
        },
      });
      setReports(json.reports || []);
      setNotice(`Loaded ${json.reports?.length || 0} reports.`);
    } catch (err: unknown) {
      setLog((logs) => [
        messageFromUnknown(err, "Failed to load reports"),
        ...logs,
      ]);
    } finally {
      setLoadingReports(false);
    }
  };

  const loadAuditEvents = async () => {
    if (!adminJwt.trim()) {
      setLog((logs) => ["Admin JWT required", ...logs]);
      return;
    }
    try {
      setNotice(null);
      const json = await fetchWorkerJson<{ events?: AuditEvent[] }>(
        `${WORKER_URL}/admin/audit/events?limit=20`,
        {
          headers: {
            Authorization: `Bearer ${adminJwt.trim()}`,
          },
        }
      );
      setAuditEvents(json.events || []);
      setNotice(`Loaded ${json.events?.length || 0} audit events.`);
    } catch (err: unknown) {
      setLog((logs) => [
        messageFromUnknown(err, "Failed to load audit events"),
        ...logs,
      ]);
    }
  };

  const sendAnnouncement = async () => {
    if (!adminJwt.trim()) {
      setLog((logs) => ["Admin JWT required", ...logs]);
      return;
    }
    if (!roomId || !announcement.trim()) return;
    setNotice(null);
    try {
      await fetchWorkerJson(`${WORKER_URL}/admin/announcement`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminJwt.trim()}`,
        },
        body: JSON.stringify({
          roomId,
          content: announcement.trim(),
          userId: "admin",
        }),
      });
      setLog((logs) => ["Announcement sent", ...logs]);
      setAnnouncement("");
      setNotice("Announcement sent.");
    } catch (err: unknown) {
      setLog((logs) => [messageFromUnknown(err, "Announcement failed"), ...logs]);
    }
  };

  return (
    <ConsoleShell className="max-w-4xl lg:max-w-4xl">
      <ConsolePageHeader
        title="Moderation"
        description={
          <>
            Mute, ban, and room announcements. Project:{" "}
            <code>{activeProject?.name || "none selected"}</code>
          </>
        }
      />
      {notice ? <Banner variant="success">{notice}</Banner> : null}

      <Section title="User actions">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <RoomPicker token={sessionToken} value={roomId} onChange={setRoomId} placeholder="Room ID" />
          <Input
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="User ID"
          />
          <label className="text-xs text-muted-foreground">
            Mute duration (seconds)
            <Input
              type="number"
              value={duration}
              min={5}
              onChange={(e) => setDuration(Number(e.target.value))}
              style={{
                marginLeft: 8,
                width: 100,
                padding: "4px 6px",
              }}
            />
          </label>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Button onClick={() => runAction("mute")}>Mute</Button>
          <Button onClick={() => runAction("unmute")}>Unmute</Button>
          <Button onClick={() => runAction("ban")}>Ban</Button>
          <Button onClick={() => runAction("unban")}>Unban</Button>
        </div>
      </Section>

      <Section
        title="Reports queue"
        actions={
          <Button onClick={loadReports} disabled={loadingReports}>
            {loadingReports ? "Loading…" : "Refresh"}
          </Button>
        }
      >
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No reports yet. When users report messages via the API, they will
            appear here.
          </p>
        ) : (
          <div
            className="flex flex-col gap-2 text-sm"
          >
            {reports.map((r) => (
              <div key={r.id} className={`flex flex-col gap-1 ${consoleDarkCardClass}`}>
                <div className={`flex items-center justify-between ${consoleDarkCardMutedClass}`}>
                  <span>
                    Room: <code className={consoleDarkCodeClass}>{r.room_id}</code> · User:{" "}
                    <code className={consoleDarkCodeClass}>{r.user_id}</code>
                    {typeof r.target_message_id === "number"
                      ? ` · msg #${r.target_message_id}`
                      : ""}
                  </span>
                  <span>
                    {formatDateTime(r.created_at)}
                  </span>
                </div>
                {r.reason && (
                  <div className="text-sm text-[#e5e7eb]">
                    Reason: {r.reason}
                  </div>
                )}
                <div className="mt-1 flex gap-2">
                  <Button
                    onClick={() => {
                      setRoomId(r.room_id);
                      setUserId(r.user_id);
                      void runAction("mute");
                    }}
                  >
                    Mute user
                  </Button>
                  <Button
                    onClick={() => {
                      setRoomId(r.room_id);
                      setUserId(r.user_id);
                      void runAction("ban");
                    }}
                  >
                    Ban user
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Audit events"
        actions={<Button onClick={loadAuditEvents}>Refresh</Button>}
      >
        {auditEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No audit events loaded yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {auditEvents.map((event) => (
              <div key={event.id} className={consoleDarkCardClass}>
                <div>
                  <strong className="text-slate-100">{event.action}</strong> by{" "}
                  <code className={consoleDarkCodeClass}>{event.actor_user_id}</code>
                </div>
                <div className={`mt-1 ${consoleDarkCardMutedClass}`}>
                  {event.target_type || "target"}:{" "}
                  <code className={consoleDarkCodeClass}>{event.target_id || "-"}</code> ·{" "}
                  {formatDateTime(event.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Webhooks (bots & integrations)"
        description={
          <>
            Register per-project webhooks that receive events like <code>message.created</code>{" "}
            or <code>report.created</code>.
          </>
        }
      >
        <p className="mb-2 text-sm text-muted-foreground">
          Register per-project webhooks that receive events like{" "}
          <code>message.created</code> or <code>report.created</code>. Provide a JWT
          (with <code>tid</code> = project id) to associate the webhook with a
          project.
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Input
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="Webhook URL (https://...)"
          />
          <Input
            value={webhookEvents}
            onChange={(e) => setWebhookEvents(e.target.value)}
            placeholder="Event types (comma-separated, e.g. message.created,report.created)"
          />
          <Input
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
            placeholder="Optional signing secret (used for X-Fluxy-Signature)"
          />
        </div>
        <Button
          onClick={async () => {
            if (!webhookUrl || !webhookEvents || !adminJwt.trim()) {
              setLog((logs) => [
                "Webhook URL, events, and admin JWT are required",
                ...logs,
              ]);
              return;
            }
            try {
              const json = await fetchWorkerJson<{ webhook?: { id: string } }>(
                `${WORKER_URL}/webhooks/register`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${adminJwt.trim()}`,
                  },
                  body: JSON.stringify({
                    url: webhookUrl,
                    eventTypes: webhookEvents
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                    secret: webhookSecret || undefined,
                  }),
                }
              );
              setLog((logs) => [
                `Registered webhook ${json.webhook?.id || ""}`,
                ...logs,
              ]);
              setNotice("Webhook registered.");
              await loadWebhooks();
            } catch (err: unknown) {
              setLog((logs) => [
                messageFromUnknown(err, "Failed to register webhook"),
                ...logs,
              ]);
            }
          }}
        >
          Register webhook
        </Button>
        <div style={{ marginTop: 16 }}>
          <div className="mb-2 flex items-center gap-2">
            <strong className="text-sm">Registered webhooks</strong>
            <Button onClick={() => void loadWebhooks()} disabled={webhookListLoading}>
              {webhookListLoading ? "Loading…" : "Refresh"}
            </Button>
          </div>
          {webhookRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {webhookRows.map((w) => (
                <WebhookRowCard
                  key={w.id}
                  row={w}
                  adminJwt={adminJwt.trim()}
                  onChanged={loadWebhooks}
                />
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Announcements">
        <Textarea
          value={announcement}
          onChange={(e) => setAnnouncement(e.target.value)}
          rows={4}
          placeholder="Share release notes or admin updates with the room."
          style={{ marginBottom: 8 }}
        />
        <Button onClick={sendAnnouncement}>Send announcement</Button>
      </Section>

      <Section title="AI system bot">
        <p className="mb-2 text-sm text-muted-foreground">
          Trigger an AI-generated summary of the recent conversation in this
          room. Requires AI_BASE_URL (and optional AI_API_KEY/AI_MODEL) to be
          configured on the Worker.
        </p>
        <Button
          onClick={async () => {
            try {
              await fetchWorkerJson(`${WORKER_URL}/automation/trigger`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${adminJwt.trim()}`,
                },
                body: JSON.stringify({
                  eventType: "room_summary",
                  roomId,
                  payload: {},
                }),
              });
              setLog((logs) => ["Requested AI room summary", ...logs]);
              setNotice("AI room summary requested.");
            } catch (err: unknown) {
              setLog((logs) => [
                messageFromUnknown(err, "Unknown error"),
                ...logs,
              ]);
            }
          }}
        >
          Generate AI room summary
        </Button>
      </Section>

      <section
        className={`${consoleDarkCardClass} p-4`}
      >
        <h2 className="mb-3 text-lg font-semibold">Activity log</h2>
        <div
          className="flex flex-col gap-1.5 text-sm text-[#e5e7eb]"
        >
          {log.length === 0 && (
            <p className="text-muted-foreground">No actions yet.</p>
          )}
          {log.map((entry, idx) => (
            <div key={idx} className="opacity-90">
              • {entry}
            </div>
          ))}
        </div>
      </section>
    </ConsoleShell>
  );
}

function WebhookRowCard({
  row,
  adminJwt,
  onChanged,
}: {
  row: WebhookRow;
  adminJwt: string;
  onChanged: () => void;
}) {
  const [url, setUrl] = useState(row.url);
  const [events, setEvents] = useState(row.event_types);
  const [secret, setSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [patchError, setPatchError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    setUrl(row.url);
    setEvents(row.event_types);
    setSecret("");
    setPatchError(null);
  }, [row.id, row.url, row.event_types]);

  const patch = async () => {
    if (!adminJwt) return;
    setSaving(true);
    setPatchError(null);
    try {
      const body: { url?: string; eventTypes?: string[]; secret?: string } = {};
      if (url.trim() && url.trim() !== row.url) body.url = url.trim();
      const ev = events
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (ev.join(",") !== row.event_types) body.eventTypes = ev;
      if (secret.trim()) body.secret = secret.trim();
      if (!Object.keys(body).length) return;
      await fetchWorkerJson(`${WORKER_URL}/webhooks/${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminJwt}`,
        },
        body: JSON.stringify(body),
      });
      onChanged();
    } catch (e: unknown) {
      setPatchError(messageFromUnknown(e, "Update failed"));
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async () => {
    if (!adminJwt) return;
    setPatchError(null);
    try {
      await fetchWorkerJson(`${WORKER_URL}/webhooks/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminJwt}` },
      });
      onChanged();
    } catch (e: unknown) {
      setPatchError(messageFromUnknown(e, "Delete failed"));
    }
  };

  return (
    <div className={`${consoleDarkCardClass} p-3 text-sm`}>
      <div className="mb-2">
        <code className="text-blue-300">{row.id}</code>
        <span className="ml-2 text-[#6b7280]">{formatDateTime(row.created_at)}</span>
      </div>
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" />
      <Input
        value={events}
        onChange={(e) => setEvents(e.target.value)}
        placeholder="event types, comma-separated"
        style={{ marginTop: 8 }}
      />
      <Input
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        placeholder="New secret (optional; leave empty to keep)"
        style={{ marginTop: 8 }}
      />
      {patchError ? <p className="mt-2 text-sm text-red-400">{patchError}</p> : null}
      <div className="mt-2.5 flex gap-2">
        <Button variant="primary" onClick={() => void patch()} disabled={saving || !adminJwt}>
          {saving ? "Saving…" : "Save changes"}
        </Button>
        <Button onClick={() => setDeleteOpen(true)} disabled={!adminJwt}>
          Delete
        </Button>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete webhook?"
        description={`Remove webhook ${row.id}. Integrations using this URL will stop receiving events.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={() => void executeDelete()}
      />
    </div>
  );
}

