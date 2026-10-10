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
  getDevice(deviceId: string): Promise<IoTDevicePublic>;
  deleteDevice(deviceId: string): Promise<{ ok: boolean }>;
  deleteReadings(deviceId: string, filter?: { sensor?: string; from?: string; to?: string }): Promise<{ ok: boolean }>;
  ingestReading(deviceId: string, reading: { sensor: string; value: number; unit?: string }, deviceKey?: string): Promise<SensorReading>;
  listReadings(deviceId: string, filter?: { sensor?: string; from?: string; to?: string; limit?: number }): Promise<SensorReading[]>;
  getHealth(deviceId: string, sensor?: string): Promise<{ health: number; sampleSize: number; alerts: string[] }>;
  getShadow(deviceId: string): Promise<{ reported: Record<string, unknown>; desired: Record<string, unknown> }>;
  setDesired(deviceId: string, desired: Record<string, unknown>): Promise<{ reported: Record<string, unknown>; desired: Record<string, unknown> }>;
  createRule(input: {
    name: string;
    deviceId?: string;
    fleetId?: string;
    condition: RuleCondition;
    action: RuleAction;
  }): Promise<{ id: string; name: string }>;
  listRules(): Promise<Array<{ id: string; name: string }>>;
  listAlarms(deviceId?: string): Promise<Array<{ id: string; deviceId: string; status: string; message: string }>>;
  ackAlarm(alarmId: string): Promise<{ ok: boolean }>;
  clearAlarm(alarmId: string): Promise<{ ok: boolean }>;
  assignAlarm(alarmId: string, assigneeId: string): Promise<{ ok: boolean; assigneeId: string }>;
  unassignAlarm(alarmId: string): Promise<{ ok: boolean }>;
  listPersistentRpc(deviceId: string): Promise<Array<{ id: string; method: string; status: string }>>;
  deleteRpc(deviceId: string, rpcId: string): Promise<{ ok: boolean }>;
  sendRpc(deviceId: string, method: string, params?: Record<string, unknown>): Promise<{ id: string; method: string }>;
  pullRpc(deviceId: string, deviceKey?: string): Promise<{ id: string; method: string; params: Record<string, unknown> } | null>;
  replyRpc(deviceId: string, rpcId: string, result?: unknown, deviceKey?: string): Promise<{ ok: boolean }>;
  listReadingKeys(deviceId: string): Promise<string[]>;
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
    async getDevice(deviceId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`getDevice failed: ${res.status}`);
      const body = (await res.json()) as { device: IoTDevicePublic };
      return body.device;
    },
    async deleteDevice(deviceId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`deleteDevice failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async deleteReadings(deviceId, filter) {
      const url = new URL(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/readings`);
      if (filter?.sensor) url.searchParams.set("sensor", filter.sensor);
      if (filter?.from) url.searchParams.set("from", filter.from);
      if (filter?.to) url.searchParams.set("to", filter.to);
      const res = await fetch(url.toString(), { method: "DELETE", headers: await headers(client) });
      if (!res.ok) throw new Error(`deleteReadings failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async ingestReading(deviceId, reading, deviceKey) {
      const auth = deviceKey
        ? { Authorization: `Bearer ${deviceKey}` }
        : await headers(client);
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/readings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify(reading),
      });
      if (!res.ok) throw new Error(`ingestReading failed: ${res.status}`);
      const body = (await res.json()) as { reading: SensorReading };
      return body.reading;
    },
    async listReadings(deviceId, filter) {
      const url = new URL(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/readings`);
      if (filter?.sensor) url.searchParams.set("sensor", filter.sensor);
      if (filter?.from) url.searchParams.set("from", filter.from);
      if (filter?.to) url.searchParams.set("to", filter.to);
      if (filter?.limit) url.searchParams.set("limit", String(filter.limit));
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listReadings failed: ${res.status}`);
      const body = (await res.json()) as { readings: SensorReading[] };
      return body.readings ?? [];
    },
    async getHealth(deviceId, sensor) {
      const url = new URL(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/health`);
      if (sensor) url.searchParams.set("sensor", sensor);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`getHealth failed: ${res.status}`);
      return (await res.json()) as { health: number; sampleSize: number; alerts: string[] };
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
    async listRules() {
      const res = await fetch(`${base(client)}/iot/rules`, { headers: await headers(client) });
      if (!res.ok) throw new Error(`listRules failed: ${res.status}`);
      const body = (await res.json()) as { rules: Array<{ id: string; name: string }> };
      return body.rules ?? [];
    },
    async listAlarms(deviceId) {
      const url = new URL(`${base(client)}/iot/alarms`);
      if (deviceId) url.searchParams.set("deviceId", deviceId);
      const res = await fetch(url.toString(), { headers: await headers(client) });
      if (!res.ok) throw new Error(`listAlarms failed: ${res.status}`);
      const body = (await res.json()) as { alarms: Array<{ id: string; deviceId: string; status: string; message: string }> };
      return body.alarms ?? [];
    },
    async ackAlarm(alarmId) {
      const res = await fetch(`${base(client)}/iot/alarms/${encodeURIComponent(alarmId)}/ack`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`ackAlarm failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async clearAlarm(alarmId) {
      const res = await fetch(`${base(client)}/iot/alarms/${encodeURIComponent(alarmId)}/clear`, {
        method: "POST",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`clearAlarm failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async assignAlarm(alarmId, assigneeId) {
      const res = await fetch(`${base(client)}/iot/alarms/${encodeURIComponent(alarmId)}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ assigneeId }),
      });
      if (!res.ok) throw new Error(`assignAlarm failed: ${res.status}`);
      return (await res.json()) as { ok: boolean; assigneeId: string };
    },
    async unassignAlarm(alarmId) {
      const res = await fetch(`${base(client)}/iot/alarms/${encodeURIComponent(alarmId)}/assign`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`unassignAlarm failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async listPersistentRpc(deviceId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/rpc/persistent`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listPersistentRpc failed: ${res.status}`);
      const body = (await res.json()) as { rpcs: Array<{ id: string; method: string; status: string }> };
      return body.rpcs ?? [];
    },
    async deleteRpc(deviceId, rpcId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/rpc/${encodeURIComponent(rpcId)}`, {
        method: "DELETE",
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`deleteRpc failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async sendRpc(deviceId, method, params) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/rpc`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await headers(client)) },
        body: JSON.stringify({ method, params }),
      });
      if (!res.ok) throw new Error(`sendRpc failed: ${res.status}`);
      const body = (await res.json()) as { rpc: { id: string; method: string } };
      return body.rpc;
    },
    async pullRpc(deviceId, deviceKey) {
      const auth = deviceKey ? { Authorization: `Bearer ${deviceKey}` } : await headers(client);
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/rpc`, {
        headers: auth,
      });
      if (!res.ok) throw new Error(`pullRpc failed: ${res.status}`);
      const body = (await res.json()) as { rpc: { id: string; method: string; params: Record<string, unknown> } | null };
      return body.rpc;
    },
    async replyRpc(deviceId, rpcId, result, deviceKey) {
      const auth = deviceKey ? { Authorization: `Bearer ${deviceKey}` } : await headers(client);
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/rpc/${encodeURIComponent(rpcId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...auth },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) throw new Error(`replyRpc failed: ${res.status}`);
      return (await res.json()) as { ok: boolean };
    },
    async listReadingKeys(deviceId) {
      const res = await fetch(`${base(client)}/iot/devices/${encodeURIComponent(deviceId)}/readings/keys`, {
        headers: await headers(client),
      });
      if (!res.ok) throw new Error(`listReadingKeys failed: ${res.status}`);
      const body = (await res.json()) as { keys: string[] };
      return body.keys ?? [];
    },
  };
}
