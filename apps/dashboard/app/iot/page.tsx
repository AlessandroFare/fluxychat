"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Radio, RefreshCw } from "lucide-react";
import { ConsoleShell } from "../components/console-shell";
import { ConsolePageHeader } from "../components/console-page-header";
import { ConsoleProjectRoomBar } from "../components/console-project-room-bar";
import { ConsoleFeedback } from "../components/console-feedback";
import { Button, Input, Panel, Section } from "../components/ui";
import { Badge } from "~/components/ui/badge";
import { useDashboardSession } from "../components/dashboard-session";
import { messageFromUnknown } from "@/lib/error-message";
import {
  createIotRule,
  getIotHealth,
  getIotShadow,
  ingestIotReading,
  listIotDevices,
  registerIotDevice,
  setIotDesiredShadow,
  type IotDeviceRow,
  type IotHealth,
  type IotShadow,
} from "@/lib/iot-client";

const DEVICE_TYPES = ["sensor", "actuator", "gateway", "camera", "display", "speaker", "custom"];

export default function IotPage() {
  const { adminJwt, lastRoom } = useDashboardSession();
  const token = adminJwt.trim();

  const [devices, setDevices] = useState<IotDeviceRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [shadow, setShadow] = useState<IotShadow | null>(null);
  const [health, setHealth] = useState<IotHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [name, setName] = useState("Warehouse sensor");
  const [type, setType] = useState("sensor");
  const [fleetId, setFleetId] = useState("default");
  const [roomId, setRoomId] = useState("");
  const [sensor, setSensor] = useState("temperature");
  const [value, setValue] = useState("22.5");
  const [unit, setUnit] = useState("C");
  const [desiredJson, setDesiredJson] = useState('{"setpoint": 21}');
  const [ruleName, setRuleName] = useState("High temperature alert");
  const [ruleOp, setRuleOp] = useState(">");
  const [ruleValue, setRuleValue] = useState("30");

  useEffect(() => {
    if (!roomId && lastRoom?.id) setRoomId(lastRoom.id);
  }, [lastRoom?.id, roomId]);

  const loadDevices = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listIotDevices(token, fleetId.trim() ? { fleetId: fleetId.trim() } : undefined);
      setDevices(rows);
      setSelectedId((current) => {
        if (current && rows.some((d) => d.id === current)) return current;
        return rows[0]?.id ?? null;
      });
    } catch (err) {
      setError(messageFromUnknown(err, "Failed to list devices"));
    } finally {
      setLoading(false);
    }
  }, [token, fleetId]);

  const loadDeviceDetail = useCallback(async (deviceId: string) => {
    if (!token) return;
    try {
      const [nextShadow, nextHealth] = await Promise.all([
        getIotShadow(token, deviceId),
        getIotHealth(token, deviceId, sensor.trim() || undefined),
      ]);
      setShadow(nextShadow);
      setHealth(nextHealth);
    } catch (err) {
      setShadow(null);
      setHealth(null);
      setError(messageFromUnknown(err, "Failed to load shadow"));
    }
  }, [token, sensor]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    if (selectedId) void loadDeviceDetail(selectedId);
  }, [selectedId, loadDeviceDetail]);

  async function handleRegister() {
    if (!token || !name.trim()) return;
    setBusy("register");
    setError(null);
    try {
      const result = await registerIotDevice(token, {
        name: name.trim(),
        type,
        fleetId: fleetId.trim() || "default",
        roomId: roomId.trim() || undefined,
      });
      setSelectedId(result.device.id);
      setNotice(`Device ${result.device.id} registered. Copy the API key now — it is shown once: ${result.apiKey}`);
      await loadDevices();
    } catch (err) {
      setError(messageFromUnknown(err, "Register failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleIngest() {
    if (!token || !selectedId) return;
    setBusy("ingest");
    setError(null);
    try {
      const reading = await ingestIotReading(token, selectedId, {
        sensor: sensor.trim() || "value",
        value: Number(value),
        unit: unit.trim() || undefined,
      });
      setNotice(`Reading ${reading.id} ingested. Room fans out iot.reading.`);
      await loadDeviceDetail(selectedId);
      await loadDevices();
    } catch (err) {
      setError(messageFromUnknown(err, "Ingest failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleDesired() {
    if (!token || !selectedId) return;
    setBusy("desired");
    setError(null);
    try {
      const parsed = JSON.parse(desiredJson) as Record<string, unknown>;
      const next = await setIotDesiredShadow(token, selectedId, parsed);
      setShadow(next);
      setNotice("Desired shadow updated. Device firmware should poll and converge.");
    } catch (err) {
      setError(messageFromUnknown(err, "Desired shadow failed"));
    } finally {
      setBusy(null);
    }
  }

  async function handleRule() {
    if (!token || !selectedId) return;
    setBusy("rule");
    setError(null);
    try {
      const rule = await createIotRule(token, {
        name: ruleName.trim(),
        deviceId: selectedId,
        fleetId: fleetId.trim() || undefined,
        condition: { sensor: sensor.trim() || "temperature", operator: ruleOp, value: Number(ruleValue) },
        action: { type: "chat_message", target: roomId.trim() || selectedId, payload: `${sensor} ${ruleOp} ${ruleValue}` },
      });
      setNotice(`Rule ${rule.id} saved.`);
    } catch (err) {
      setError(messageFromUnknown(err, "Rule create failed"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="IoT"
        description="Register a device, post readings over HTTP, keep a desired/reported shadow. If you bind a room, readings show up as iot.reading events."
        icon={Radio}
      />
      <ConsoleProjectRoomBar
        requireProject
        preferRoom
        hint="Bind a room if you want readings on the chat timeline (and ambient agents can react)."
      />
      <ConsoleFeedback error={error} notice={notice} />

      {!token ? (
        <Panel className="p-6 text-sm text-muted-foreground">
          Admin JWT required. <Link href="/projects" className="font-medium underline-offset-2 hover:underline">Projects</Link>.
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <div className="space-y-6">
            <Section title="Register device">
              <Panel className="space-y-3">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Device name" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {DEVICE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  <Input value={fleetId} onChange={(e) => setFleetId(e.target.value)} placeholder="Fleet id" />
                </div>
                <Input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Room id (fan-out)" />
                <Button size="sm" disabled={busy === "register"} onClick={() => void handleRegister()}>
                  {busy === "register" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Register
                </Button>
              </Panel>
            </Section>

            <Section title="Fleet">
              <div className="mb-3 flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => void loadDevices()}>
                  <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                </Button>
                {loading ? <span className="text-xs text-muted-foreground">Loading…</span> : null}
              </div>
              {devices.length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices in this fleet yet.</p>
              ) : (
                <div className="space-y-2">
                  {devices.map((device) => (
                    <button
                      key={device.id}
                      type="button"
                      onClick={() => setSelectedId(device.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                        selectedId === device.id ? "border-primary bg-primary/5" : "border-border bg-card"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{device.name}</span>
                        <Badge variant="outline">{device.status}</Badge>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground">{device.id}</p>
                    </button>
                  ))}
                </div>
              )}
            </Section>
          </div>

          <div className="space-y-6">
            <Section title="Shadow and ingest">
              {!selectedId ? (
                <p className="text-sm text-muted-foreground">Select a device.</p>
              ) : (
                <Panel className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Health {health?.health ?? "—"}</span>
                    {health?.alerts?.length ? <Badge variant="outline">{health.alerts.join(", ")}</Badge> : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <Input value={sensor} onChange={(e) => setSensor(e.target.value)} placeholder="Sensor" />
                    <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Value" />
                    <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit" />
                  </div>
                  <Button size="sm" disabled={busy === "ingest"} onClick={() => void handleIngest()}>
                    {busy === "ingest" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Ingest reading
                  </Button>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Reported</p>
                      <pre className="max-h-40 overflow-auto rounded-md bg-muted/40 p-2 text-[11px]">
                        {JSON.stringify(shadow?.reported ?? {}, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Desired</p>
                      <textarea
                        className="min-h-24 w-full rounded-md border border-border bg-background p-2 font-mono text-[11px]"
                        value={desiredJson}
                        onChange={(e) => setDesiredJson(e.target.value)}
                      />
                      <Button className="mt-2" size="sm" variant="outline" disabled={busy === "desired"} onClick={() => void handleDesired()}>
                        Patch desired
                      </Button>
                    </div>
                  </div>
                </Panel>
              )}
            </Section>

            <Section title="Threshold rule">
              <Panel className="space-y-3">
                <Input value={ruleName} onChange={(e) => setRuleName(e.target.value)} placeholder="Rule name" />
                <div className="grid gap-2 sm:grid-cols-2">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm"
                    value={ruleOp}
                    onChange={(e) => setRuleOp(e.target.value)}
                  >
                    {["<", "<=", ">", ">=", "==", "!="].map((op) => (
                      <option key={op} value={op}>{op}</option>
                    ))}
                  </select>
                  <Input value={ruleValue} onChange={(e) => setRuleValue(e.target.value)} placeholder="Threshold" />
                </div>
                <Button size="sm" disabled={!selectedId || busy === "rule"} onClick={() => void handleRule()}>
                  Save rule on selected device
                </Button>
                <p className="text-xs text-muted-foreground">
                  Pair with{" "}
                  <Link href="/agents/ambient" className="underline underline-offset-2">ambient agents</Link>
                  {" "}on message_keyword / room_event if you want an LLM to react to readings.
                </p>
              </Panel>
            </Section>
          </div>
        </div>
      )}
    </ConsoleShell>
  );
}
