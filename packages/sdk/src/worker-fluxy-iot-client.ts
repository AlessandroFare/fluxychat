import type { FluxyChatClient } from "./index";
import type { IoTDevicePublic, RuleAction, RuleCondition, SensorReading } from "./fluxy-iot";

export interface WorkerFluxyIoTClient {
  registerDevice(input: {
    name: string;
    type?: string;
    fleetId?: string;
    roomId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ device: IoTDevicePublic; apiKey: string }>;
  listDevices(filter?: { fleetId?: string }): Promise<IoTDevicePublic[]>;
  ingestReading(deviceId: string, reading: { sensor: string; value: number; unit?: string }): Promise<SensorReading>;
  getShadow(deviceId: string): Promise<{ reported: Record<string, unknown>; desired: Record<string, unknown> }>;
  setDesired(deviceId: string, desired: Record<string, unknown>): Promise<{ reported: Record<string, unknown>; desired: Record<string, unknown> }>;
  createRule(input: {
    name: string;
    deviceId?: string;
    fleetId?: string;
    condition: RuleCondition;
    action: RuleAction;
  }): Promise<{ id: string; name: string }>;
}

async function headers(client: FluxyChatClient): Promise<HeadersInit> {
  await client.resolveToken?.();
  return (client as unknown as { authHeaders?: () => HeadersInit }).authHeaders?.() ?? {};
}

function base(client: FluxyChatClient): string {
  return (client as unknown as { baseUrl?: string }).baseUrl?.replace(/\/$/, "") ?? "";
}

export function createWorkerFluxyIoTClient(client: FluxyChatClient): WorkerFluxyIoTClient {
  return {
    async registerDevice(input) {
      const res = await fetch(`${base(client)}/iot/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`registerDevice failed: ${res.status}`);
      return (await res.json()) as { device: IoTDevicePublic; apiKey: string };
    },
    async listDevices(filter) {
      const url = new URL(`${base(client)}/iot/devices`);
      if (filter?.fleetId) url.searchParams.set("fleetId", filter.fleetId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listDevices failed: ${res.status}`);
      const body = (await res.json()) as { devices: IoTDevicePublic[] };
      return body.devices;
    },
    async ingestReading(deviceId, reading) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(reading),
      });
      if (!res.ok) throw new Error(`ingestReading failed: ${res.status}`);
      const body = (await res.json()) as { reading: SensorReading };
      return body.reading;
    },
    async getShadow(deviceId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/shadow`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getShadow failed: ${res.status}`);
      const body = (await res.json()) as { shadow: { reported: Record<string, unknown>; desired: Record<string, unknown> } };
      return body.shadow;
    },
    async setDesired(deviceId, desired) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/shadow`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ desired }),
      });
      if (!res.ok) throw new Error(`setDesired failed: ${res.status}`);
      const body = (await res.json()) as { shadow: { reported: Record<string, unknown>; desired: Record<string, unknown> } };
      return body.shadow;
    },
    async createRule(input) {
      const res = await fetch(`${base(client)}/iot/rules`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(`createRule failed: ${res.status}`);
      const body = (await res.json()) as { rule: { id: string; name: string } };
      return body.rule;
    },
  };
}
