"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Cpu, Thermometer, Activity, AlertTriangle, CheckCircle2,
  Plus, Wifi, WifiOff, Settings, Bell, MapPin, Wrench,
  Loader2, Zap, Shield, RefreshCw,
} from "lucide-react";
import { ConsoleShell } from "@/app/components/console-shell";
import { ConsolePageHeader } from "@/app/components/console-page-header";
import { ConsoleProjectRoomBar } from "@/app/components/console-project-room-bar";
import { WorkerBackendBadge } from "@/app/components/worker-backend-badge";
import { cn } from "@/lib/utils";
import { useWorkerChatClient } from "@/lib/use-worker-chat-client";
import {
  createFluxyIoT,
  createWorkerFluxyIoTClient,
  type FluxyIoTApi,
  type IoTDevice,
  type IoTDevicePublic,
  type Alert as IotAlert,
  type WorkerFluxyIoTClient,
} from "@fluxy-chat/sdk";

function createSeededIoT(): FluxyIoTApi {
  const iot = createFluxyIoT();
  const fleet1 = iot.createFleet("Factory Floor A");
  const fleet2 = iot.createFleet("Warehouse B");

  const d1 = iot.provisionDevice("Temperature Sensor 01", "sensor", fleet1.id, { location: "Assembly Line 1" });
  const d2 = iot.provisionDevice("Pressure Gauge 02", "sensor", fleet1.id, { location: "Hydraulic Press" });
  const d3 = iot.provisionDevice("Humidity Sensor 03", "sensor", fleet1.id, { location: "Storage Room" });
  iot.provisionDevice("Smart Camera 01", "camera", fleet2.id, { location: "Loading Dock" });
  iot.provisionDevice("Gateway 01", "gateway", fleet2.id, { location: "Server Room" });

  // Seed readings
  for (let i = 0; i < 20; i++) {
    iot.ingestReading(d1.id, "temperature", 20 + Math.random() * 15, "°C");
    iot.ingestReading(d2.id, "pressure", 80 + Math.random() * 40, "bar");
    iot.ingestReading(d3.id, "humidity", 40 + Math.random() * 30, "%");
  }

  // Seed a rule
  iot.createRule("High temperature alert",
    [{ sensor: "temperature", operator: ">", value: 30 }],
    [{ type: "alert", target: "room:alerts", payload: "Temperature exceeded 30°C!" }],
  );
  iot.createRule("Low pressure warning",
    [{ sensor: "pressure", operator: "<", value: 90 }],
    [{ type: "alert", target: "room:alerts", payload: "Pressure below 90 bar!" }],
  );

  // Seed shadow
  iot.setDesiredState(d1.id, { temperature: 22, sampling_rate: 5 });
  iot.setDesiredState(d2.id, { pressure: 100, calibration: "auto" });

  // Seed geofence
  iot.createGeofence("Factory Perimeter", 45.4642, 9.1900, 500, d1.id);
  iot.createGeofence("Warehouse Zone", 45.4700, 9.1850, 300);

  return iot;
}

export default function FluxyIoTPage() {
  const chatClient = useWorkerChatClient("iot-demo");
  const workerIoT = useMemo(
    () => (chatClient ? createWorkerFluxyIoTClient(chatClient) : null),
    [chatClient],
  );
  const [iot] = useState<FluxyIoTApi | null>(createSeededIoT());
  const [tick, setTick] = useState(0);
  const [workerDevices, setWorkerDevices] = useState<IoTDevicePublic[]>([]);
  const [workerBusy, setWorkerBusy] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"devices" | "readings" | "rules" | "alerts" | "shadow" | "ota" | "geofence" | "doctor">("devices");

  useEffect(() => {
    if (!workerIoT) {
      setWorkerDevices([]);
      return;
    }
    void workerIoT.listDevices().then(setWorkerDevices).catch(() => setWorkerDevices([]));
  }, [workerIoT, tick]);

  if (!iot) return null;

  const workerConnected = Boolean(workerIoT);

  async function registerWorkerDevice(name: string) {
    if (!workerIoT) return;
    setWorkerBusy(true);
    setWorkerError(null);
    try {
      await workerIoT.registerDevice({ name, type: "sensor", fleetId: "default" });
      setTick((t) => t + 1);
    } catch (err) {
      setWorkerError(err instanceof Error ? err.message : "Register failed");
    } finally {
      setWorkerBusy(false);
    }
  }

  const tabs: { id: typeof activeTab; label: string; icon: React.ReactNode }[] = [
    { id: "devices", label: "Devices", icon: <Cpu className="size-3.5" /> },
    { id: "readings", label: "Sensor Data", icon: <Activity className="size-3.5" /> },
    { id: "rules", label: "Rule Engine", icon: <Zap className="size-3.5" /> },
    { id: "alerts", label: "Alerts", icon: <Bell className="size-3.5" /> },
    { id: "shadow", label: "Device Shadow", icon: <RefreshCw className="size-3.5" /> },
    { id: "ota", label: "OTA Updates", icon: <Settings className="size-3.5" /> },
    { id: "geofence", label: "Geofencing", icon: <MapPin className="size-3.5" /> },
    { id: "doctor", label: "AI Device Doctor", icon: <Wrench className="size-3.5" /> },
  ];

  return (
    <ConsoleShell>
      <ConsolePageHeader
        title="FluxyIoT"
        description="MQTT bridge & IoT device management — provisioning, rule engine, device shadow, OTA, geofencing, AI diagnostics"
        actions={<WorkerBackendBadge connected={workerConnected} label="FluxyIoT" />}
      />
      <ConsoleProjectRoomBar
        requireProject
        hint={workerConnected ? "Devices, readings, and rules sync to your Worker fleet APIs." : "Local seeded fleet for exploration; sign in to provision devices on D1."}
      />
      {workerError ? (
        <p className="mx-4 mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-600">{workerError}</p>
      ) : null}
      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", activeTab === tab.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4">
        {activeTab === "devices" && (
          <DevicesTab
            iot={iot}
            workerIoT={workerIoT}
            workerDevices={workerDevices}
            workerBusy={workerBusy}
            onRegisterWorker={() => void registerWorkerDevice(`Sensor-${Date.now()}`)}
            onReload={() => setTick((t) => t + 1)}
          />
        )}
        {activeTab === "readings" && <ReadingsTab iot={iot} workerIoT={workerIoT} workerDevices={workerDevices} onReload={() => setTick((t) => t + 1)} />}
        {activeTab === "rules" && <RulesTab iot={iot} workerIoT={workerIoT} onReload={() => setTick((t) => t + 1)} />}
        {activeTab === "alerts" && <AlertsTab iot={iot} onReload={() => setTick(t => t + 1)} />}
        {activeTab === "shadow" && <ShadowTab iot={iot} workerIoT={workerIoT} workerDevices={workerDevices} />}
        {activeTab === "ota" && <OTATab iot={iot} onReload={() => setTick(t => t + 1)} />}
        {activeTab === "geofence" && <GeofenceTab iot={iot} />}
        {activeTab === "doctor" && <DoctorTab iot={iot} />}
      </div>
    </ConsoleShell>
  );
}

function DevicesTab({
  iot,
  workerIoT,
  workerDevices,
  workerBusy,
  onRegisterWorker,
  onReload,
}: {
  iot: FluxyIoTApi;
  workerIoT: WorkerFluxyIoTClient | null;
  workerDevices: IoTDevicePublic[];
  workerBusy: boolean;
  onRegisterWorker: () => void;
  onReload: () => void;
}) {
  const fleets = iot.listFleets();
  const devices = workerDevices.length > 0 ? workerDevices : iot.listDevices();
  const statusColors: Record<string, string> = { online: "bg-green-500/15 text-green-600", offline: "bg-red-500/15 text-red-600", degraded: "bg-amber-500/15 text-amber-600", maintenance: "bg-blue-500/15 text-blue-600" };

  return (
    <div>
      {workerIoT ? (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onRegisterWorker} disabled={workerBusy} className="rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">
            {workerBusy ? <Loader2 className="mr-1 inline size-3.5 animate-spin" /> : <Plus className="mr-1 inline size-3.5" />}
            Register device on Worker
          </button>
          <span className="text-xs text-muted-foreground">{workerDevices.length} persisted device(s)</span>
        </div>
      ) : null}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {fleets.map((f) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-3">
            <div className="text-sm font-semibold">{f.name}</div>
            <div className="mt-1 flex gap-3 text-[10px] text-muted-foreground">
              <span>{f.deviceCount} devices</span>
              <span className="text-green-600">{f.onlineCount} online</span>
              {f.alertCount > 0 && <span className="text-red-600">{f.alertCount} alerts</span>}
            </div>
          </div>
        ))}
      </div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Devices ({devices.length})</h3>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((d: IoTDevice) => (
          <div key={d.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("flex size-8 items-center justify-center rounded-lg", d.status === "online" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground")}>
                  {d.status === "online" ? <Wifi className="size-4" /> : <WifiOff className="size-4" />}
                </span>
                <div><h4 className="text-sm font-semibold">{d.name}</h4><code className="text-[10px] text-muted-foreground">{d.id}</code></div>
              </div>
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", statusColors[d.status])}>{d.status}</span>
            </div>
              <div className="mt-2 text-[10px] text-muted-foreground">
              <div>Type: {d.type} · FW: {d.firmwareVersion}</div>
              <div>Last seen: {d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString() : "—"}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadingsTab({
  iot,
  workerIoT,
  workerDevices,
  onReload,
}: {
  iot: FluxyIoTApi;
  workerIoT: WorkerFluxyIoTClient | null;
  workerDevices: IoTDevicePublic[];
  onReload: () => void;
}) {
  const localDevices = iot.listDevices();
  const devices = workerDevices.length > 0 ? workerDevices : localDevices;
  const [selected, setSelected] = useState(devices[0]?.id || "");
  const readings = workerIoT && workerDevices.some((d) => d.id === selected)
    ? []
    : iot.getReadings(selected, undefined, 30);
  const sensorTypes = [...new Set(readings.map((r) => r.sensor))];
  const sensorIcons: Record<string, React.ReactNode> = { temperature: <Thermometer className="size-3" />, pressure: <Activity className="size-3" />, humidity: <Activity className="size-3" /> };

  const maxVals: Record<string, number> = {};
  for (const r of readings) { maxVals[r.sensor] = Math.max(maxVals[r.sensor] || 0, r.value); }
  const minVals: Record<string, number> = {};
  for (const r of readings) { minVals[r.sensor] = Math.min(minVals[r.sensor] || Infinity, r.value); }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device readings</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="mb-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div className="space-y-3">
          {sensorTypes.map((sensor) => {
            const sensorReadings = readings.filter((r) => r.sensor === sensor);
            const max = maxVals[sensor] || 1;
            const min = minVals[sensor] || 0;
            const range = max - min || 1;
            return (
              <div key={sensor}>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="flex items-center gap-1 font-medium">{sensorIcons[sensor]} {sensor}</span><span className="text-muted-foreground">{min.toFixed(1)} - {max.toFixed(1)}</span></div>
                <div className="flex h-16 items-end gap-0.5">
                  {sensorReadings.map((r, i) => {
                    const height = ((r.value - min) / range) * 100;
                    return <div key={i} className="flex-1 rounded-t bg-blue-500/50" style={{ height: `${Math.max(height, 4)}%` }} title={`${r.value.toFixed(1)}${r.unit}`} />;
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recent readings</h3>
        <div className="h-64 space-y-0.5 overflow-auto rounded-lg border border-border bg-card p-2">
          {readings.slice(-20).reverse().map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-1 py-0.5 text-[11px] font-mono">
              <span className="text-muted-foreground">{new Date(r.timestamp).toLocaleTimeString()}</span>
              <span className="font-medium">{r.sensor}</span>
              <span className="font-bold">{r.value.toFixed(1)}{r.unit}</span>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => {
          if (workerIoT && workerDevices.some((d) => d.id === selected)) {
            void workerIoT.ingestReading(selected, { sensor: "temperature", value: 25 + Math.random() * 15, unit: "°C" }).then(onReload);
            return;
          }
          iot.ingestReading(selected, "temperature", 25 + Math.random() * 15, "°C");
          onReload();
        }} className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted">
          Inject test reading{workerIoT && workerDevices.some((d) => d.id === selected) ? " · Worker" : ""}
        </button>
      </div>
    </div>
  );
}

function RulesTab({
  iot,
  workerIoT,
  onReload,
}: {
  iot: FluxyIoTApi;
  workerIoT: WorkerFluxyIoTClient | null;
  onReload: () => void;
}) {
  const rules = iot.listRules();
  return (
    <div>
      {workerIoT ? (
        <button
          type="button"
          onClick={() => {
            void workerIoT.createRule({
              name: `Worker rule ${Date.now()}`,
              condition: { sensor: "temperature", operator: ">", value: 28 },
              action: { type: "alert", target: "room:alerts", payload: "High temp from Worker" },
            }).then(onReload);
          }}
          className="mb-3 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-muted"
        >
          Create rule on Worker
        </button>
      ) : null}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Rule engine ({rules.length})</h3>
      <div className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold">{r.name}</h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">{r.triggeredCount} triggers</span>
                <button type="button" onClick={() => { iot.toggleRule(r.id); }} className={cn("rounded px-2 py-0.5 text-[9px] font-semibold uppercase", r.enabled ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground")}>{r.enabled ? "ON" : "OFF"}</button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.conditions.map((c, i) => (<span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono">{c.sensor} {c.operator} {c.value}</span>))}
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">→ {r.actions.map((a) => `${a.type}: ${a.payload.slice(0, 40)}`).join(", ")}</div>
            {r.lastTriggered && <div className="mt-1 text-[10px] text-muted-foreground">Last: {new Date(r.lastTriggered).toLocaleString()}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

function AlertsTab({ iot, onReload }: { iot: FluxyIoTApi; onReload: () => void }) {
  const alerts = iot.listAlerts();
  const severityColors: Record<string, string> = { critical: "bg-red-500/15 text-red-600", warning: "bg-amber-500/15 text-amber-600", info: "bg-blue-500/15 text-blue-600" };
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Alerts ({alerts.length})</h3>
      <div className="space-y-1.5">
        {alerts.length === 0 ? <p className="text-sm text-muted-foreground">No alerts. Inject readings that trigger rules to see alerts.</p> : alerts.map((a: IotAlert) => (
          <div key={a.id} className={cn("flex items-center gap-3 rounded-lg border p-3", a.acknowledged ? "border-border bg-muted/30 opacity-60" : "border-border bg-card")}>
            <AlertTriangle className={cn("size-4", severityColors[a.severity] ? "text-amber-500" : "text-muted-foreground")} />
            <div className="flex-1">
              <div className="text-sm">{a.message}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(a.timestamp).toLocaleString()} · {a.deviceId}</div>
            </div>
            <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", severityColors[a.severity])}>{a.severity}</span>
            {!a.acknowledged && <button type="button" onClick={() => { iot.acknowledgeAlert(a.id); onReload(); }} className="rounded-lg border border-border px-2 py-1 text-[10px] hover:bg-muted">Ack</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

function ShadowTab({
  iot,
  workerIoT,
  workerDevices,
}: {
  iot: FluxyIoTApi;
  workerIoT: WorkerFluxyIoTClient | null;
  workerDevices: IoTDevicePublic[];
}) {
  const devices = workerDevices.length > 0 ? workerDevices : iot.listDevices();
  const [selected, setSelected] = useState(devices[0]?.id || "");
  const [workerShadow, setWorkerShadow] = useState<{ reported: Record<string, unknown>; desired: Record<string, unknown> } | null>(null);

  useEffect(() => {
    if (!workerIoT || !selected || !workerDevices.some((d) => d.id === selected)) {
      setWorkerShadow(null);
      return;
    }
    void workerIoT.getShadow(selected).then(setWorkerShadow).catch(() => setWorkerShadow(null));
  }, [workerIoT, selected, workerDevices]);

  const localShadow = iot.getShadow(selected);
  const shadow = workerShadow
    ? { desired: workerShadow.desired, reported: workerShadow.reported, delta: {} as Record<string, { desired: unknown; reported: unknown }> }
    : localShadow;
  const deltaKeys = shadow ? Object.keys(shadow.delta) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </div>
      <div className="lg:col-span-2">
        {shadow && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase text-blue-600">Desired state</h4>
              <pre className="text-[11px] font-mono text-muted-foreground">{JSON.stringify(shadow.desired, null, 2)}</pre>
            </div>
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4">
              <h4 className="mb-2 text-xs font-semibold uppercase text-green-600">Reported state</h4>
              <pre className="text-[11px] font-mono text-muted-foreground">{JSON.stringify(shadow.reported, null, 2)}</pre>
            </div>
            {deltaKeys.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <h4 className="mb-2 text-xs font-semibold uppercase text-amber-600">Delta ({deltaKeys.length} keys)</h4>
                <div className="space-y-1">
                  {deltaKeys.map((k) => (
                    <div key={k} className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{k}:</span>
                      <span className="text-blue-600">desired={JSON.stringify(shadow.delta[k].desired)}</span>
                      <span className="text-muted-foreground">≠</span>
                      <span className="text-green-600">reported={JSON.stringify(shadow.delta[k].reported)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function OTATab({ iot, onReload }: { iot: FluxyIoTApi; onReload: () => void }) {
  const fleets = iot.listFleets();
  const updates = iot.listOTAUpdates();
  const [version, setVersion] = useState("1.2.0");
  const [selectedFleet, setSelectedFleet] = useState(fleets[0]?.id || "");

  const handleRollout = () => {
    if (!version.trim()) return;
    iot.createOTAUpdate(selectedFleet, version.trim(), `https://ota.fluxychat.dev/${version}/firmware.bin`);
    setVersion("");
    onReload();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">New OTA rollout</h3>
        <div className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div><label className="mb-1 block text-xs font-medium">Fleet</label><select value={selectedFleet} onChange={(e) => setSelectedFleet(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">{fleets.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
          <div><label className="mb-1 block text-xs font-medium">Version</label><input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" /></div>
          <button type="button" onClick={handleRollout} disabled={!version.trim()} className="w-full rounded-lg bg-[var(--fluxy-cta-color)] px-3 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50">Start rollout</button>
        </div>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Update history ({updates.length})</h3>
        <div className="space-y-2">
          {updates.length === 0 ? <p className="text-sm text-muted-foreground">No OTA updates yet</p> : updates.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold">v{u.version}</span><span className={cn("rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase", u.status === "completed" ? "bg-green-500/15 text-green-600" : u.status === "rolling_out" ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600")}>{u.status}</span></div>
              <div className="text-[10px] text-muted-foreground">{u.devicesUpdated}/{u.devicesTotal} devices · {new Date(u.createdAt).toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GeofenceTab({ iot }: { iot: FluxyIoTApi }) {
  const fences = iot.listGeofences();
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Geofences ({fences.length})</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fences.map((f) => (
          <div key={f.id} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /><h4 className="text-sm font-semibold">{f.name}</h4></div>
            <div className="mt-2 text-[10px] text-muted-foreground">
              <div>Center: {f.lat.toFixed(4)}, {f.lng.toFixed(4)}</div>
              <div>Radius: {f.radiusM}m</div>
              {f.deviceId && <div>Device: {f.deviceId}</div>}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
        <h4 className="text-xs font-semibold text-blue-600">Test geofence check</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {iot.listDevices().slice(0, 3).map((d) => {
            const result = iot.checkGeofence(d.id, 45.4642, 9.1900);
            return (
              <div key={d.id} className="rounded-lg border border-border p-2 text-xs">
                <div className="font-medium">{d.name}</div>
                <div className="text-green-600">Inside: {result.inside.length}</div>
                <div className="text-muted-foreground">Outside: {result.outside.length}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function DoctorTab({ iot }: { iot: FluxyIoTApi }) {
  const devices = iot.listDevices();
  const [selected, setSelected] = useState(devices[0]?.id || "");
  const diagnosis = iot.diagnoseDevice(selected);
  const severityColors: Record<string, string> = { critical: "bg-red-500/15 text-red-600", warning: "bg-amber-500/15 text-amber-600", info: "bg-green-500/15 text-green-600" };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Select device</h3>
        <select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
          {devices.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.status})</option>)}
        </select>
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">AI diagnosis</h3>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-3">
            <span className={cn("rounded-lg px-3 py-1.5 text-sm font-semibold uppercase", severityColors[diagnosis.severity])}>{diagnosis.severity}</span>
            <div className="text-sm font-bold">Confidence: {(diagnosis.confidence * 100).toFixed(0)}%</div>
          </div>
          <p className="mt-3 text-sm">{diagnosis.diagnosis}</p>
          <div className="mt-3 rounded-lg bg-muted/50 p-2 text-xs"><span className="font-medium">Recommendation:</span> {diagnosis.recommendation}</div>
        </div>
      </div>
    </div>
  );
}
