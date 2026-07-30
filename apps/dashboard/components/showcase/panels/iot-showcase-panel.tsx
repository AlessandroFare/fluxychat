"use client";

import React from "react";
import { Cpu, Gauge, Loader2, Radio } from "lucide-react";
import { createWorkerFluxyIoTClient } from "@fluxy-chat/sdk";
import { Button } from "@/components/ui/button";
import type { ShowcaseSession } from "../use-showcase-session";

interface DeviceRow {
  id: string;
  name: string;
  tempC: number;
  updatedAt: string;
}

export function IoTShowcasePanel({ session }: { session: ShowcaseSession }) {
  const client = session.client!;
  const roomId = session.roomId!;
  const [devices, setDevices] = React.useState<DeviceRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [wsLive, setWsLive] = React.useState(false);
  const deviceIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const iot = createWorkerFluxyIoTClient(client);
    void iot
      .registerDevice({
        name: "Showcase sensor",
        type: "sensor",
        roomId,
      })
      .then(({ device }) => {
        if (cancelled) return;
        deviceIdRef.current = device.id;
        setDevices([{ id: device.id, name: device.name, tempC: 22, updatedAt: "registered" }]);
      })
      .catch(() => {
        if (cancelled) return;
        deviceIdRef.current = "sensor-7";
        setDevices([{ id: "sensor-7", name: "Cold room A", tempC: 4.2, updatedAt: "local fallback" }]);
        setError("Could not register device — using local fallback.");
      });
    return () => {
      cancelled = true;
    };
  }, [client, roomId]);

  React.useEffect(() => {
    const conn = client.connectRoom(roomId);
    conn.connect();
    const off = conn.onServerEvent((ev) => {
      if (ev.name !== "iot.reading") return;
      setWsLive(true);
      const deviceId = String(ev.data.deviceId ?? "");
      const value = Number(ev.data.value);
      if (!deviceId || !Number.isFinite(value)) return;
      setDevices((prev) =>
        prev.map((d) =>
          d.id === deviceId ? { ...d, tempC: value, updatedAt: "WS live" } : d,
        ),
      );
    });
    return () => {
      off();
      conn.close();
    };
  }, [client, roomId]);

  async function publishReading() {
    setBusy(true);
    setError(null);
    const deviceId = deviceIdRef.current ?? devices[0]?.id;
    if (!deviceId) return;
    const device = devices.find((d) => d.id === deviceId) ?? devices[0];
    if (!device) return;
    const nextTemp = Math.round((device.tempC + (Math.random() - 0.5) * 2) * 10) / 10;
    try {
      const iot = createWorkerFluxyIoTClient(client);
      await iot.ingestReading(deviceId, { sensor: "tempC", value: nextTemp, unit: "C" });
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, tempC: nextTemp, updatedAt: "just now" } : d)),
      );
    } catch {
      setDevices((prev) =>
        prev.map((d) => (d.id === deviceId ? { ...d, tempC: nextTemp, updatedAt: "simulated" } : d)),
      );
      setError("Worker IoT route unavailable — showing local simulation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-[26rem] flex-col p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-cyan-100 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
          <Cpu className="size-5" aria-hidden />
        </span>
        <div>
          <h4 className="font-semibold text-foreground">FluxyIoT telemetry</h4>
          <p className="text-xs text-muted-foreground">
            Devices + rules · room {roomId}
            {wsLive ? " · WS live" : ""}
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-2">
        {devices.map((device) => (
          <li
            key={device.id}
            className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm"
          >
            <div>
              <p className="font-medium text-foreground">{device.name}</p>
              <p className="text-[11px] text-muted-foreground">{device.id} · {device.updatedAt}</p>
            </div>
            <span className="inline-flex items-center gap-1 font-mono text-foreground">
              <Gauge className="size-3.5 text-[var(--fluxy-cta-color)]" aria-hidden />
              {device.tempC}°C
            </span>
          </li>
        ))}
      </ul>

      {error ? <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">{error}</p> : null}

      <Button type="button" className="mt-auto" onClick={() => void publishReading()} disabled={busy || devices.length === 0}>
        {busy ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden /> : <Radio className="mr-2 size-4" aria-hidden />}
        Publish reading
      </Button>
    </div>
  );
}
