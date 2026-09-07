import { getPublicWorkerUrl } from "@/lib/worker-url-client";
import { fetchWorkerJson } from "@/lib/worker-fetch";

const BASE = getPublicWorkerUrl();

export interface IotDeviceRow {
  id: string;
  name: string;
  type: string;
  fleetId: string;
  roomId?: string;
  status: string;
  firmwareVersion?: string;
  lastSeen?: string;
  metadata?: Record<string, unknown>;
}

export interface IotShadow {
  deviceId?: string;
  reported: Record<string, unknown>;
  desired: Record<string, unknown>;
  updatedAt?: string;
}

export interface IotHealth {
  deviceId: string;
  sensor: string | null;
  sampleSize: number;
  mean: number | null;
  slope: number | null;
  health: number;
  alerts: string[];
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function listIotDevices(
  token: string,
  filter?: { fleetId?: string },
): Promise<IotDeviceRow[]> {
  const url = new URL(`${BASE}/iot/devices`);
  if (filter?.fleetId) url.searchParams.set("fleetId", filter.fleetId);
  const res = await fetchWorkerJson<{ devices?: IotDeviceRow[] }>(url.toString(), {
    headers: authHeaders(token),
  });
  return res.devices ?? [];
}

export async function registerIotDevice(
  token: string,
  input: { name: string; type?: string; fleetId?: string; roomId?: string },
): Promise<{ device: IotDeviceRow; apiKey: string }> {
  const res = await fetchWorkerJson<{ device: IotDeviceRow; apiKey: string }>(`${BASE}/iot/devices`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res;
}

export async function ingestIotReading(
  token: string,
  deviceId: string,
  reading: { sensor: string; value: number; unit?: string },
): Promise<{ id: string; deviceId: string; sensor: string; value: number; timestamp: string }> {
  const res = await fetchWorkerJson<{ reading: { id: string; deviceId: string; sensor: string; value: number; timestamp: string } }>(
    `${BASE}/iot/devices/${encodeURIComponent(deviceId)}/readings`,
    {
      method: "POST",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(reading),
    },
  );
  return res.reading;
}

export async function getIotShadow(token: string, deviceId: string): Promise<IotShadow> {
  const res = await fetchWorkerJson<{ shadow: IotShadow }>(
    `${BASE}/iot/devices/${encodeURIComponent(deviceId)}/shadow`,
    { headers: authHeaders(token) },
  );
  return res.shadow;
}

export async function setIotDesiredShadow(
  token: string,
  deviceId: string,
  desired: Record<string, unknown>,
): Promise<IotShadow> {
  const res = await fetchWorkerJson<{ shadow: IotShadow }>(
    `${BASE}/iot/devices/${encodeURIComponent(deviceId)}/shadow`,
    {
      method: "PATCH",
      headers: { ...authHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify({ desired }),
    },
  );
  return res.shadow;
}

export async function getIotHealth(
  token: string,
  deviceId: string,
  sensor?: string,
): Promise<IotHealth> {
  const url = new URL(`${BASE}/iot/devices/${encodeURIComponent(deviceId)}/health`);
  if (sensor) url.searchParams.set("sensor", sensor);
  return fetchWorkerJson<IotHealth>(url.toString(), { headers: authHeaders(token) });
}

export async function createIotRule(
  token: string,
  input: {
    name: string;
    deviceId?: string;
    fleetId?: string;
    condition: { sensor: string; operator: string; value: number };
    action: { type: string; target: string; payload: string };
  },
): Promise<{ id: string; name: string }> {
  const res = await fetchWorkerJson<{ rule: { id: string; name: string } }>(`${BASE}/iot/rules`, {
    method: "POST",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return res.rule;
}
