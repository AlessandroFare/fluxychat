"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Headphones, Loader2, Plus, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { Banner, Button, Input, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createCannedResponse,
  deleteCannedResponse,
  getBusinessHours,
  getSupportStats,
  listCannedResponses,
  upsertBusinessHours,
  type SupportStats,
} from "@/lib/competitor-parity-client";

const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

type DaySchedule = { open?: string; close?: string; enabled?: boolean };

export default function SupportSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [responses, setResponses] = useState<
    Array<{ id: string; shortcut: string; title: string; body: string; category: string | null; usageCount: number }>
  >([]);
  const [stats, setStats] = useState<SupportStats | null>(null);

  const [hoursEnabled, setHoursEnabled] = useState(false);
  const [timezone, setTimezone] = useState("UTC");
  const [offlineMessage, setOfflineMessage] = useState("");
  const [schedule, setSchedule] = useState<Record<string, DaySchedule>>({});
  const [isWithinHours, setIsWithinHours] = useState(true);

  const [newShortcut, setNewShortcut] = useState("hello");
  const [newTitle, setNewTitle] = useState("Greeting");
  const [newBody, setNewBody] = useState("Hi! How can I help you today?");
  const [newCategory, setNewCategory] = useState("general");

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [canned, hours, supportStats] = await Promise.all([
        listCannedResponses(token),
        getBusinessHours(token),
        getSupportStats(token).catch(() => null),
      ]);
      setResponses(canned.responses ?? []);
      setHoursEnabled(hours.enabled);
      setTimezone(hours.timezone);
      setOfflineMessage(hours.offlineMessage);
      setSchedule(hours.schedule ?? {});
      setIsWithinHours(hours.isWithinHours);
      setStats(supportStats);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load support settings"));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateMacro() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await createCannedResponse(token, {
        shortcut: newShortcut,
        title: newTitle,
        body: newBody,
        category: newCategory || undefined,
      });
      if (!result.ok) {
        setError(result.error || "Create failed");
        return;
      }
      setNotice(`Macro /${newShortcut.replace(/^\//, "")} created.`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Create failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMacro(id: string, shortcut: string) {
    if (!token) return;
    setBusy(true);
    setError(null);
    try {
      await deleteCannedResponse(token, id);
      setNotice(`Deleted /${shortcut}`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Delete failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveHours() {
    if (!token) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await upsertBusinessHours(token, {
        enabled: hoursEnabled,
        timezone,
        schedule,
        offlineMessage,
      });
      setNotice("Business hours saved.");
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  function updateDay(day: string, patch: Partial<DaySchedule>) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], ...patch },
    }));
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Support vertical"
        description="Canned responses, business hours, and ticket stats."
        icon={Headphones}
      />
      <ConsoleFeedback error={error} notice={notice} />

      {loading ? (
        <div className="flex items-center text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          {stats ? (
            <Section title="Support stats">
              <Panel className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard label="Open tickets" value={String(stats.openTickets)} />
                <StatCard label="Avg satisfaction" value={stats.avgSatisfaction.toFixed(1)} />
                <StatCard label="Avg first response (h)" value={stats.avgFirstResponseHours.toFixed(1)} />
                <StatCard
                  label="KB articles"
                  value={`${stats.kbArticles.published}/${stats.kbArticles.total}`}
                />
              </Panel>
            </Section>
          ) : null}

          <Section title="CSAT (post-chat)">
            <Panel className="space-y-2 p-4 text-sm text-muted-foreground">
              <p>
                Surveys are created automatically when tickets are resolved/closed or when a room handoff
                ends. End users respond via{" "}
                <code className="text-xs">POST /support/csat/:id/respond</code> with rating 1–10.
              </p>
              <p>
                Pending survey lookup:{" "}
                <code className="text-xs">GET /support/csat/pending?roomId=…</code>
              </p>
            </Panel>
          </Section>

          <Section title="Canned responses">
            <Panel className="space-y-4 p-4">
              {responses.length === 0 ? (
                <p className="text-sm text-muted-foreground">No macros yet. Create one below.</p>
              ) : (
                <ul className="space-y-2">
                  {responses.map((r) => (
                    <li
                      key={r.id}
                      className="flex flex-wrap items-start gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Badge variant="outline">/{r.shortcut}</Badge>
                      {r.category ? <Badge variant="secondary">{r.category}</Badge> : null}
                      <span className="font-medium">{r.title}</span>
                      <span className="w-full text-xs text-muted-foreground line-clamp-2">{r.body}</span>
                      <span className="text-xs text-muted-foreground">Used {r.usageCount}×</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="ml-auto text-destructive"
                        disabled={busy}
                        onClick={() => void handleDeleteMacro(r.id, r.shortcut)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}

              <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Shortcut</span>
                  <Input value={newShortcut} onChange={(e) => setNewShortcut(e.target.value)} placeholder="hello" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium">Category</span>
                  <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="general" />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">Title</span>
                  <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </label>
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">Body</span>
                  <textarea
                    className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={newBody}
                    onChange={(e) => setNewBody(e.target.value)}
                  />
                </label>
              </div>
              <Button type="button" disabled={busy || !token} onClick={() => void handleCreateMacro()}>
                <Plus className="mr-1 h-4 w-4" /> Add macro
              </Button>
            </Panel>
          </Section>

          <Section title="Business hours">
            <Panel className="space-y-4 p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={isWithinHours ? "default" : "secondary"}>
                  {isWithinHours ? "Within hours" : "Outside hours"}
                </Badge>
                <Clock className="h-4 w-4 text-muted-foreground" />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hoursEnabled}
                    onChange={(e) => setHoursEnabled(e.target.checked)}
                  />
                  Enforce business hours
                </label>
              </div>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Timezone (IANA)</span>
                <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="America/New_York" />
              </label>

              <label className="block text-sm">
                <span className="mb-1 block font-medium">Offline message</span>
                <textarea
                  className="min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={offlineMessage}
                  onChange={(e) => setOfflineMessage(e.target.value)}
                />
              </label>

              <div className="space-y-2">
                {WEEKDAYS.map((day) => {
                  const dayCfg = schedule[day] ?? { enabled: false };
                  return (
                    <div key={day} className="flex flex-wrap items-center gap-2 text-sm">
                      <label className="flex w-28 items-center gap-2 capitalize">
                        <input
                          type="checkbox"
                          checked={dayCfg.enabled !== false}
                          onChange={(e) => updateDay(day, { enabled: e.target.checked })}
                        />
                        {day}
                      </label>
                      <Input
                        className="w-24"
                        value={dayCfg.open ?? "09:00"}
                        onChange={(e) => updateDay(day, { open: e.target.value })}
                        placeholder="09:00"
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        className="w-24"
                        value={dayCfg.close ?? "17:00"}
                        onChange={(e) => updateDay(day, { close: e.target.value })}
                        placeholder="17:00"
                      />
                    </div>
                  );
                })}
              </div>

              <Button type="button" disabled={busy || !token} onClick={() => void handleSaveHours()}>
                Save business hours
              </Button>
            </Panel>
          </Section>
        </>
      )}

      {!token ? <Banner variant="warning">Admin JWT required.</Banner> : null}
    </ConsoleShell>
  );
}

function StatCard(props: { label: string; value: string }) {
  return (
    <div className="rounded-md border px-3 py-2">
      <p className="text-xs text-muted-foreground">{props.label}</p>
      <p className="text-lg font-semibold">{props.value}</p>
    </div>
  );
}
