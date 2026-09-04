"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Clock, Loader2, Trash2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Panel, Section } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getRoomMessageRetention,
  listRoomMessageRetention,
  purgeRoomMessageRetention,
  updateRoomMessageRetention,
  type RoomMessageRetentionSettings,
  type RoomRetentionListItem,
} from "@/lib/room-message-retention-client";

const MODES: RoomMessageRetentionSettings["mode"][] = ["standard", "ephemeral", "custom"];

export default function EphemeralRetentionSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");
  const [settings, setSettings] = useState<RoomMessageRetentionSettings | null>(null);
  const [configuredRooms, setConfiguredRooms] = useState<RoomRetentionListItem[]>([]);
  const [ttlHours, setTtlHours] = useState(24);

  const loadRoom = useCallback(async () => {
    if (!token || !roomId.trim()) {
      setSettings(null);
      return;
    }
    setError(null);
    try {
      const data = await getRoomMessageRetention(token, roomId.trim());
      setSettings(data.settings);
      if (data.settings.ttlSeconds) {
        setTtlHours(Math.max(1, Math.round(data.settings.ttlSeconds / 3600)));
      }
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room retention"));
      setSettings(null);
    }
  }, [token, roomId]);

  const loadList = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listRoomMessageRetention(token);
      setConfiguredRooms(data.rooms ?? []);
    } catch {
      setConfiguredRooms([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadList().finally(() => setLoading(false));
  }, [token, loadList]);

  useEffect(() => {
    if (roomId.trim()) void loadRoom();
  }, [roomId, loadRoom]);

  async function save(mode: RoomMessageRetentionSettings["mode"]) {
    if (!token || !roomId.trim()) return;
    setBusy("save");
    setError(null);
    setNotice(null);
    try {
      const ttlSeconds =
        mode === "standard" ? null : mode === "ephemeral" && !settings?.ttlSeconds
          ? 86400
          : Math.max(60, ttlHours * 3600);
      const data = await updateRoomMessageRetention(token, roomId.trim(), { mode, ttlSeconds });
      setSettings(data.settings);
      setNotice("Room retention updated.");
      await loadList();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save retention"));
    } finally {
      setBusy(null);
    }
  }

  async function runPurge() {
    if (!token || !roomId.trim()) return;
    setBusy("purge");
    try {
      const data = await purgeRoomMessageRetention(token, roomId.trim());
      setNotice(`Purged ${data.purged ?? 0} expired messages.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Purge failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Ephemeral & room TTL"
        description="Per-room message retention: standard history, ephemeral TTL, or custom seconds. Nightly cron soft-deletes expired rows."
      />

      <p className="mb-4 text-sm text-muted-foreground">
        <Link href="/settings" className="font-medium underline-offset-4 hover:underline">
          ← Back to settings
        </Link>
        {" · "}
        <Link href="/settings/retention" className="font-medium underline-offset-4 hover:underline">
          Legal retention policies
        </Link>
      </p>

      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">Admin JWT required from Projects.</Panel>
      ) : loading ? (
        <p className="text-sm text-muted-foreground">
          <Loader2 className="inline h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <div className="space-y-8">
          <Section title="Configure room">
            <RoomPicker token={token} value={roomId} onChange={setRoomId} placeholder="Select room" />
            {settings ? (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Current: <Badge variant="outline">{settings.mode}</Badge>
                  {settings.ttlSeconds ? ` · TTL ${Math.round(settings.ttlSeconds / 3600)}h` : null}
                  {settings.updatedAt ? ` · updated ${formatDateTime(settings.updatedAt)}` : null}
                </p>
                <div className="flex flex-wrap gap-2">
                  {MODES.map((mode) => (
                    <Button
                      key={mode}
                      size="sm"
                      variant={settings.mode === mode ? "default" : "outline"}
                      disabled={busy === "save"}
                      onClick={() => void save(mode)}
                    >
                      {mode}
                    </Button>
                  ))}
                </div>
                {settings.mode !== "standard" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="text-sm text-muted-foreground">
                      TTL (hours)
                      <input
                        type="number"
                        min={1}
                        className="ml-2 w-20 rounded border border-border px-2 py-1 text-sm"
                        value={ttlHours}
                        onChange={(e) => setTtlHours(Number(e.target.value) || 24)}
                      />
                    </label>
                    <Button size="sm" variant="outline" disabled={busy === "save"} onClick={() => void save(settings.mode)}>
                      Apply TTL
                    </Button>
                    <Button size="sm" variant="outline" disabled={busy === "purge"} onClick={() => void runPurge()}>
                      {busy === "purge" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="mr-2 h-4 w-4" />
                      )}
                      Purge now
                    </Button>
                  </div>
                ) : null}
              </div>
            ) : roomId.trim() ? (
              <p className="mt-3 text-sm text-muted-foreground">Loading room settings…</p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Pick a room to configure TTL.</p>
            )}
          </Section>

          <Section title="Configured rooms">
            {configuredRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No non-standard retention rooms yet.</p>
            ) : (
              <ul className="divide-y rounded-lg bg-card shadow-[var(--shadow-2)]">
                {configuredRooms.map((r) => (
                  <li key={r.roomId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <span>
                      <Clock className="mr-1 inline h-4 w-4 text-muted-foreground" />
                      {r.roomId}
                    </span>
                    <span className="text-muted-foreground">
                      {r.mode}
                      {r.ttlSeconds ? ` · ${Math.round(r.ttlSeconds / 3600)}h` : ""}
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
