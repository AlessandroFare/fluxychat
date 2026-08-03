"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Cpu, Loader2 } from "lucide-react";
import { ConsoleShell } from "../../components/console-shell";
import { ConsolePageHeader } from "../../components/console-page-header";
import { ConsoleFeedback } from "../../components/console-feedback";
import { RoomPicker } from "../../components/room-picker";
import { Button, Input, Panel, Section, Textarea } from "../../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../../components/dashboard-session";
import { formatDateTime } from "@/lib/format-datetime";
import { messageFromUnknown } from "@/lib/error-message";
import {
  getRoomFirmware,
  listFirmwareAudit,
  updateRoomFirmware,
  type FirmwareAuditEntry,
  type FirmwareModuleConfig,
  type RoomFirmwareSettings,
} from "@/lib/room-firmware-client";

const DEFAULT_MODULES: FirmwareModuleConfig[] = [
  { id: "pii_veto", enabled: false },
  { id: "rate_limit", enabled: false, maxPerMinute: 30 },
  { id: "denylist", enabled: false, patterns: [] },
];

function mergeModules(firmware: RoomFirmwareSettings | null): FirmwareModuleConfig[] {
  const existing = firmware?.config?.modules ?? [];
  return DEFAULT_MODULES.map((def) => {
    const found = existing.find((m) => m.id === def.id);
    return found ? { ...def, ...found } : def;
  });
}

export default function RoomFirmwareSettingsPage() {
  const { adminJwt } = useDashboardSession();
  const token = adminJwt.trim();

  const [roomId, setRoomId] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [firmware, setFirmware] = useState<RoomFirmwareSettings | null>(null);
  const [modules, setModules] = useState<FirmwareModuleConfig[]>(DEFAULT_MODULES);
  const [enabled, setEnabled] = useState(false);
  const [denylistText, setDenylistText] = useState("");
  const [audit, setAudit] = useState<FirmwareAuditEntry[]>([]);

  const load = useCallback(async () => {
    if (!token || !roomId.trim()) {
      setFirmware(null);
      setAudit([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [fwRes, auditRes] = await Promise.all([
        getRoomFirmware(token, roomId.trim()),
        listFirmwareAudit(token, roomId.trim(), 30),
      ]);
      const fw = fwRes.firmware ?? null;
      setFirmware(fw);
      const merged = mergeModules(fw);
      setModules(merged);
      setEnabled(fw?.enabled ?? false);
      const deny = merged.find((m) => m.id === "denylist");
      setDenylistText((deny?.patterns ?? []).join("\n"));
      setAudit(auditRes.audit ?? []);
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to load room firmware"));
    } finally {
      setLoading(false);
    }
  }, [token, roomId]);

  useEffect(() => {
    void load();
  }, [load]);

  const versionLabel = useMemo(
    () => (firmware?.version ? `v${firmware.version}` : "not configured"),
    [firmware?.version],
  );

  function patchModule(id: FirmwareModuleConfig["id"], patch: Partial<FirmwareModuleConfig>) {
    setModules((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  async function handleSave() {
    if (!token || !roomId.trim()) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const denyPatterns = denylistText
        .split(/\n|,/)
        .map((s) => s.trim())
        .filter(Boolean);
      const configModules = modules.map((m) =>
        m.id === "denylist" ? { ...m, patterns: denyPatterns } : m,
      );
      const res = await updateRoomFirmware(token, roomId.trim(), {
        enabled,
        moduleType: "builtin",
        config: { modules: configModules },
      });
      setFirmware(res.firmware);
      setNotice(`Firmware saved (${versionLabel} → v${res.firmware.version}).`);
      await load();
    } catch (err) {
      setError(messageFromUnknown(err, "Save failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="Room firmware"
        description="Per-room synchronous hooks before message fan-out — PII veto, rate limits, denylist (builtin MVP; WASM reserved)."
        icon={Cpu}
      />
      <ConsoleFeedback error={error} notice={notice} />

      <Panel>
        <Section title="Room" description="Firmware applies to message.create on the selected room.">
          <RoomPicker value={roomId} onChange={setRoomId} token={token} />
        </Section>
      </Panel>

      {roomId.trim() ? (
        loading ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading firmware…
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <Panel>
              <Section
                title="Global switch"
                description={`Module type: builtin · ${versionLabel}. WASM uploads fail-open with audit until runtime ships.`}
              >
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="size-4 rounded border-border"
                  />
                  Enable room firmware for this room
                </label>
              </Section>
            </Panel>

            <Panel>
              <Section title="Builtin modules" description="Run synchronously before insert / fan-out.">
                <div className="space-y-4">
                  <div className="rounded-md border border-border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={modules.find((m) => m.id === "pii_veto")?.enabled ?? false}
                        onChange={(e) => patchModule("pii_veto", { enabled: e.target.checked })}
                        className="size-4 rounded border-border"
                      />
                      PII veto
                    </label>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Block messages matching SSN / credit-card patterns.
                    </p>
                  </div>

                  <div className="rounded-md border border-border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={modules.find((m) => m.id === "rate_limit")?.enabled ?? false}
                        onChange={(e) => patchModule("rate_limit", { enabled: e.target.checked })}
                        className="size-4 rounded border-border"
                      />
                      Per-user rate limit
                    </label>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Max / minute</span>
                      <Input
                        type="number"
                        min={1}
                        max={600}
                        className="w-24"
                        value={modules.find((m) => m.id === "rate_limit")?.maxPerMinute ?? 30}
                        onChange={(e) =>
                          patchModule("rate_limit", {
                            maxPerMinute: Number(e.target.value) || 30,
                          })
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-border px-3 py-2">
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <input
                        type="checkbox"
                        checked={modules.find((m) => m.id === "denylist")?.enabled ?? false}
                        onChange={(e) => patchModule("denylist", { enabled: e.target.checked })}
                        className="size-4 rounded border-border"
                      />
                      Term denylist
                    </label>
                    <Textarea
                      className="mt-2 font-mono text-xs"
                      rows={4}
                      placeholder="confidential&#10;internal-only"
                      value={denylistText}
                      onChange={(e) => setDenylistText(e.target.value)}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">
                      One term per line (case-insensitive substring match).
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Button onClick={() => void handleSave()} disabled={busy}>
                    {busy ? "Saving…" : "Save firmware"}
                  </Button>
                </div>
              </Section>
            </Panel>

            <Panel>
              <Section title="Recent audit" description="Veto / modify / fail-open decisions from room_firmware_audit.">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {audit.map((row) => (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
                      >
                        <div>
                          <span className="font-mono text-xs">{row.moduleId ?? "—"}</span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <Badge variant={row.decision === "veto" ? "destructive" : "secondary"}>
                            {row.decision}
                          </Badge>
                          {row.reason ? (
                            <span className="ml-2 text-muted-foreground">{row.reason}</span>
                          ) : null}
                        </div>
                        <time className="text-xs text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            </Panel>
          </div>
        )
      ) : null}
    </ConsoleShell>
  );
}
