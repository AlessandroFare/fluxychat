"use client";

import { useCallback, useEffect, useState } from "react";
import { Languages, Loader2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Panel, Section, Banner } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getRoomTranslationSettings,
  listRoomTranslationSettings,
  updateRoomTranslationSettings,
  type RoomTranslationListItem,
  type RoomTranslationSettings,
} from "@/lib/room-translation-settings-client";
import {
  getViewerTranslationLang,
  setViewerTranslationLang,
  VIEWER_LANG_OPTIONS,
} from "@/lib/translation-viewer-prefs";

const LANG_OPTIONS = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export default function RoomTranslationSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [roomId, setRoomId] = useState("");
  const [settings, setSettings] = useState<RoomTranslationSettings | null>(null);
  const [configuredRooms, setConfiguredRooms] = useState<RoomTranslationListItem[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [targetLang, setTargetLang] = useState("en");
  const [viewerLang, setViewerLang] = useState("en");

  useEffect(() => {
    setViewerLang(getViewerTranslationLang());
  }, []);

  const loadRoom = useCallback(async () => {
    if (!token || !roomId.trim()) {
      setSettings(null);
      return;
    }
    setError(null);
    try {
      const data = await getRoomTranslationSettings(token, roomId.trim());
      setSettings(data.settings);
      setEnabled(data.settings.enabled);
      setTargetLang(data.settings.autoTranslateTarget || "en");
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load translation settings"));
      setSettings(null);
    }
  }, [token, roomId]);

  const loadList = useCallback(async () => {
    if (!token) return;
    try {
      const data = await listRoomTranslationSettings(token);
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

  async function handleSave() {
    if (!token || !roomId.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await updateRoomTranslationSettings(token, roomId.trim(), {
        enabled,
        autoTranslateTarget: enabled ? targetLang : null,
      });
      setSettings(data.settings);
      setNotice(enabled ? `Auto-translate to ${targetLang.toUpperCase()} enabled.` : "Auto-translate disabled.");
      await loadList();
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to save translation settings"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Room auto-translate"
        description="Per-room target language. New messages are translated and cached in D1."
      />

      {!token ? (
        <Banner variant="warn">Sign in with an admin JWT to configure room translation.</Banner>
      ) : loading ? (
        <div className="flex items-center gap-2 py-12 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading…
        </div>
      ) : (
        <div className="space-y-6">
          <ConsoleFeedback error={error} notice={notice} />

          <Panel title="Your viewer language">
            <p className="text-sm text-muted-foreground">
              Manual &quot;Translate&quot; in chat uses this language. Stored in your browser.
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="viewer-lang" className="mb-1 block text-xs font-medium text-muted-foreground">
                  Viewer language
                </label>
                <select
                  id="viewer-lang"
                  value={viewerLang}
                  onChange={(e) => {
                    setViewerLang(e.target.value);
                    setViewerTranslationLang(e.target.value);
                    setNotice(`Viewer language set to ${e.target.value.toUpperCase()}.`);
                  }}
                  className="w-full min-w-[12rem] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {VIEWER_LANG_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label} ({opt.value})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Panel>

          <Panel title="Configure room">
            <Section title="Select room">
              <RoomPicker value={roomId} onChange={setRoomId} token={token} />
            </Section>

            {roomId.trim() ? (
              <div className="mt-4 space-y-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="rounded border-border"
                  />
                  Enable auto-translate for this room
                </label>

                <div>
                  <label htmlFor="target-lang" className="mb-1 block text-xs font-medium text-muted-foreground">
                    Target language
                  </label>
                  <select
                    id="target-lang"
                    value={targetLang}
                    onChange={(e) => setTargetLang(e.target.value)}
                    disabled={!enabled}
                    className="w-full max-w-xs rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {LANG_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label} ({opt.value})
                      </option>
                    ))}
                  </select>
                </div>

                {settings?.updatedAt ? (
                  <p className="text-xs text-muted-foreground">
                    Last updated {formatDateTime(settings.updatedAt)}
                  </p>
                ) : null}

                <Button onClick={() => void handleSave()} disabled={busy}>
                  {busy ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <Languages className="mr-1 size-3.5" />}
                  Save settings
                </Button>
              </div>
            ) : null}
          </Panel>

          <Panel title="Configured rooms">
            {configuredRooms.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rooms with translation settings yet.</p>
            ) : (
              <ul className="space-y-2">
                {configuredRooms.map((room) => (
                  <li
                    key={room.roomId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card shadow-[var(--shadow-2)] px-3 py-2 text-sm"
                  >
                    <button
                      type="button"
                      onClick={() => setRoomId(room.roomId)}
                      className="font-medium hover:underline"
                    >
                      {room.roomId}
                    </button>
                    <div className="flex items-center gap-2">
                      {room.enabled ? (
                        <Badge variant="secondary">→ {room.autoTranslateTarget?.toUpperCase()}</Badge>
                      ) : (
                        <Badge variant="outline">disabled</Badge>
                      )}
                      {room.updatedAt ? (
                        <span className="text-[10px] text-muted-foreground">{formatDateTime(room.updatedAt)}</span>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}
    </ConsoleShell>
  );
}
