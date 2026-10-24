import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createWorkerFluxyIoTClient } from "./worker-fluxy-iot-client";

const baseUrl = "http://127.0.0.1:8787";

function client() {
  return createWorkerFluxyIoTClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function callUrl(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return String(mock.mock.calls[i]?.[0]);
}

function callInit(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return mock.mock.calls[i]?.[1] as RequestInit;
}

function callBody(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return JSON.parse(String((mock.mock.calls[i]?.[1] as RequestInit).body));
}

function callHeaders(mock: ReturnType<typeof vi.mocked<typeof fetch>>, i: number) {
  return (mock.mock.calls[i]?.[1] as RequestInit).headers as Record<string, string>;
}

describe("createWorkerFluxyIoTClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists timeseries and health", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ readings: [{ id: "rd_1", deviceId: "dev_1", sensor: "temp", value: 21, unit: "C", timestamp: "t" }] }),
    );
    fetchMock.mockResolvedValueOnce(jsonResponse({ health: 82, sampleSize: 4, alerts: [] }));
    const iot = client();
    const rows = await iot.listReadings("dev_1", { sensor: "temp" });
    const health = await iot.getHealth("dev_1", "temp");
    expect(rows[0]?.value).toBe(21);
    expect(health.health).toBe(82);
    expect(callUrl(fetchMock, 0)).toContain("/iot/devices/dev_1/readings?sensor=temp");
    expect(callUrl(fetchMock, 1)).toContain("/iot/devices/dev_1/health?sensor=temp");
  });

  it("acks an alarm and pulls RPC", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: "alm_1", status: "acked" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ rpc: { id: "rpc_1", method: "reboot", params: {} } }));
    const iot = client();
    await iot.ackAlarm("alm_1");
    const rpc = await iot.pullRpc("dev_1");
    expect(rpc?.method).toBe("reboot");
    expect(callUrl(fetchMock, 0)).toContain("/iot/alarms/alm_1/ack");
    expect(callInit(fetchMock, 0).method).toBe("POST");
  });

  it("clears an alarm and deletes a device", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, status: "cleared" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const iot = client();
    await iot.clearAlarm("alm_1");
    await iot.deleteDevice("dev_1");
    expect(callInit(fetchMock, 1).method).toBe("DELETE");
    expect(callUrl(fetchMock, 0)).toContain("/iot/alarms/alm_1/clear");
  });

  it("registers a device and returns the one-time apiKey", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ device: { id: "dev_1", name: "Sensor" }, apiKey: "iot_secret" }));
    const iot = client();
    const result = await iot.registerDevice({ name: "Sensor", type: "sensor", roomId: "room_1" });
    expect(result.apiKey).toBe("iot_secret");
    expect(result.device.id).toBe("dev_1");
    expect(callUrl(fetchMock, 0)).toBe(`${baseUrl}/iot/devices`);
    expect(callInit(fetchMock, 0).method).toBe("POST");
    expect(callBody(fetchMock, 0)).toEqual({ name: "Sensor", type: "sensor", roomId: "room_1" });
  });

  it("lists devices with the fleet filter and gets one device", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ devices: [{ id: "dev_1" }, { id: "dev_2" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ device: { id: "dev_1", status: "online" } }));
    const iot = client();
    const devices = await iot.listDevices({ fleetId: "f1" });
    const one = await iot.getDevice("dev_1");
    expect(devices).toHaveLength(2);
    expect(one.status).toBe("online");
    expect(callUrl(fetchMock, 0)).toContain("/iot/devices?fleetId=f1");
    expect(callUrl(fetchMock, 1)).toContain("/iot/devices/dev_1");
    expect(callInit(fetchMock, 1).method).toBeUndefined();
  });

  it("ingests with the project JWT or with a device key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ reading: { id: "rd_1", sensor: "temp", value: 22 } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ reading: { id: "rd_2", sensor: "temp", value: 23 } }));
    const iot = client();
    const jwtReading = await iot.ingestReading("dev_1", { sensor: "temp", value: 22 });
    const deviceReading = await iot.ingestReading("dev_1", { sensor: "temp", value: 23 }, "iot_key");
    expect(jwtReading.id).toBe("rd_1");
    expect(deviceReading.id).toBe("rd_2");
    expect(callHeaders(fetchMock, 0).Authorization).toBe("Bearer jwt");
    expect(callHeaders(fetchMock, 1).Authorization).toBe("Bearer iot_key");
    expect(callInit(fetchMock, 1).method).toBe("POST");
  });

  it("deletes readings with sensor/from/to filters", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    const iot = client();
    await iot.deleteReadings("dev_1", { sensor: "temp", from: "2026-01-01", to: "2026-01-02" });
    expect(callInit(fetchMock, 0).method).toBe("DELETE");
    expect(callUrl(fetchMock, 0)).toContain("sensor=temp&from=2026-01-01&to=2026-01-02");
  });

  it("reads and patches the shadow", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ shadow: { reported: { temp: 22 }, desired: {} } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ shadow: { reported: { temp: 22 }, desired: { setpoint: 21 } } }));
    const iot = client();
    const shadow = await iot.getShadow("dev_1");
    const patched = await iot.setDesired("dev_1", { setpoint: 21 });
    expect(shadow.reported.temp).toBe(22);
    expect(patched.desired.setpoint).toBe(21);
    expect(callInit(fetchMock, 1).method).toBe("PATCH");
    expect(callBody(fetchMock, 1)).toEqual({ desired: { setpoint: 21 } });
  });

  it("creates and lists rules", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ rule: { id: "rule_1", name: "hot" } }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ rules: [{ id: "rule_1", name: "hot" }] }));
    const iot = client();
    const rule = await iot.createRule({ name: "hot", condition: { sensor: "temp", operator: ">", value: 30 }, action: { type: "chat_message" } });
    const rules = await iot.listRules();
    expect(rule.id).toBe("rule_1");
    expect(rules).toHaveLength(1);
    expect(callBody(fetchMock, 0).condition.operator).toBe(">");
    expect(callUrl(fetchMock, 1)).toBe(`${baseUrl}/iot/rules`);
  });

  it("lists alarms with the device filter and runs assign/unassign", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ alarms: [{ id: "alm_1", deviceId: "dev_1", status: "active", message: "hot" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: "alm_1", assigneeId: "u2" }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: "alm_1", assigneeId: null }));
    const iot = client();
    const alarms = await iot.listAlarms("dev_1");
    await iot.assignAlarm("alm_1", "u2");
    await iot.unassignAlarm("alm_1");
    expect(alarms).toHaveLength(1);
    expect(callUrl(fetchMock, 0)).toContain("/iot/alarms?deviceId=dev_1");
    expect(callBody(fetchMock, 1)).toEqual({ assigneeId: "u2" });
    expect(callInit(fetchMock, 2).method).toBe("DELETE");
    expect(callUrl(fetchMock, 2)).toContain("/iot/alarms/alm_1/assign");
  });

  it("lists persistent RPC, deletes one, and sends a new one", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ rpcs: [{ id: "rpc_1", method: "reboot", status: "pending" }] }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ rpc: { id: "rpc_2", method: "reset", status: "pending" } }));
    const iot = client();
    const rpcs = await iot.listPersistentRpc("dev_1");
    await iot.deleteRpc("dev_1", "rpc_1");
    const sent = await iot.sendRpc("dev_1", "reset", { hard: true });
    expect(rpcs).toHaveLength(1);
    expect(sent.method).toBe("reset");
    expect(callUrl(fetchMock, 0)).toContain("/iot/devices/dev_1/rpc/persistent");
    expect(callInit(fetchMock, 1).method).toBe("DELETE");
    expect(callBody(fetchMock, 2)).toEqual({ method: "reset", params: { hard: true } });
  });

  it("pulls and replies to RPC with a device key", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ rpc: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, id: "rpc_1", status: "replied" }));
    const iot = client();
    const empty = await iot.pullRpc("dev_1", "iot_key");
    const reply = await iot.replyRpc("dev_1", "rpc_1", { done: true }, "iot_key");
    expect(empty).toBeNull();
    expect(reply.ok).toBe(true);
    expect(callHeaders(fetchMock, 0).Authorization).toBe("Bearer iot_key");
    expect(callHeaders(fetchMock, 1).Authorization).toBe("Bearer iot_key");
    expect(callBody(fetchMock, 1)).toEqual({ result: { done: true } });
  });

  it("lists reading keys and names the failing operation", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ keys: ["temp", "hum"] }));
    const iot = client();
    const keys = await iot.listReadingKeys("dev_1");
    expect(keys).toEqual(["temp", "hum"]);
    expect(callUrl(fetchMock, 0)).toContain("/iot/devices/dev_1/readings/keys");

    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "boom" }, 500));
    await expect(iot.getDevice("dev_1")).rejects.toThrow("getDevice failed: 500");
  });
});
