/**
 * IoT route happy paths + status mapping.
 * The IoT libs are unit-tested on their own fake D1 (`fluxy-iot.test.js`,
 * `iot-event-bus.test.js`) — this file locks the HTTP layer: dispatch,
 * JWT vs device-key auth, arg mapping and error → status codes.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchFluxyIoTRoutes } from "./fluxy-iot-http.js";
import * as iot from "../lib/fluxy-iot.js";

vi.mock("../lib/fluxy-iot.js", () => ({
  authenticateIoTDevice: vi.fn(),
  ackIoTAlarm: vi.fn(),
  assignIoTAlarm: vi.fn(),
  clearIoTAlarm: vi.fn(),
  createIoTRpc: vi.fn(),
  createIoTRule: vi.fn(),
  deleteIoTDevice: vi.fn(),
  deleteIoTReadings: vi.fn(),
  deleteIoTRpc: vi.fn(),
  getIoTDevice: vi.fn(),
  getIoTDeviceHealth: vi.fn(),
  getIoTShadow: vi.fn(),
  ingestIoTReading: vi.fn(),
  listIoTAlarms: vi.fn(),
  listIoTDevices: vi.fn(),
  listIoTReadingKeys: vi.fn(),
  listIoTReadings: vi.fn(),
  listIoTRules: vi.fn(),
  listPersistentIoTRpc: vi.fn(),
  mergeIoTReported: vi.fn(),
  pullIoTRpc: vi.fn(),
  registerIoTDevice: vi.fn(),
  replyIoTRpc: vi.fn(),
  unassignIoTAlarm: vi.fn(),
  updateIoTDesiredShadow: vi.fn(),
}));

const auth = { userId: "u1", projectId: "p1", roles: ["member"] };

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => auth,
    ...overrides,
  });
}

function request(path, { method = "GET", body, headers } = {}, h) {
  const init = { method, headers: { ...headers } };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchFluxyIoTRoutes(req, new URL(req.url), h);
}

describe("fluxy iot routes — dispatch & auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for non-iot paths and unknown iot routes", async () => {
    expect(await request("/rooms/room_1", {}, deps())).toBeNull();
    expect(await request("/iot/unknown", {}, deps())).toBeNull();
    expect(await request("/iot/devices", { method: "PUT" }, deps())).toBeNull();
    expect(await request("/iot/devices/dev_1/rpc", { method: "PATCH" }, deps())).toBeNull();
  });

  it("401s without a JWT", async () => {
    const res = await request("/iot/devices", { method: "POST", body: {} }, createAuthMatrixDeps());
    expect(res.status).toBe(401);
    await expect(res.text()).resolves.toBe("Unauthorized");

    const detail = await request("/iot/devices/dev_1", {}, createAuthMatrixDeps());
    expect(detail.status).toBe(401);
  });

  it("401s a device key for a different device (no library call)", async () => {
    iot.authenticateIoTDevice.mockResolvedValueOnce({ id: "dev_other", projectId: "p1" });
    const res = await request(
      "/iot/devices/dev_1/shadow",
      { headers: { Authorization: "Bearer iot_abc" } },
      deps(),
    );
    expect(res.status).toBe(401);
    expect(iot.authenticateIoTDevice).toHaveBeenCalledWith(expect.anything(), "iot_abc");
    expect(iot.getIoTShadow).not.toHaveBeenCalled();
  });
});

describe("fluxy iot routes — devices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST /iot/devices registers and returns the one-time apiKey", async () => {
    iot.registerIoTDevice.mockResolvedValueOnce({
      ok: true,
      device: { id: "dev_1", name: "Sensor" },
      apiKey: "iot_secret",
    });
    const res = await request("/iot/devices", { method: "POST", body: { name: "Sensor" } }, deps());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.apiKey).toBe("iot_secret");
    expect(iot.registerIoTDevice).toHaveBeenCalledWith(
      expect.objectContaining({ DB: null }),
      auth,
      { name: "Sensor" },
    );

    iot.registerIoTDevice.mockResolvedValueOnce({ ok: false, error: "name_required" });
    const bad = await request("/iot/devices", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("name_required");
  });

  it("GET /iot/devices maps fleetId and limit filters", async () => {
    iot.listIoTDevices.mockResolvedValueOnce({ ok: true, devices: [{ id: "dev_1" }] });
    const res = await request("/iot/devices?fleetId=f1&limit=5", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).devices).toHaveLength(1);
    expect(iot.listIoTDevices).toHaveBeenCalledWith(expect.anything(), auth, {
      fleetId: "f1",
      limit: 5,
    });

    iot.listIoTDevices.mockResolvedValueOnce({ ok: true, devices: [] });
    await request("/iot/devices", {}, deps());
    expect(iot.listIoTDevices).toHaveBeenLastCalledWith(expect.anything(), auth, {
      fleetId: undefined,
      limit: undefined,
    });
  });

  it("GET /iot/devices/:id passes the device through and maps not_found to 404", async () => {
    iot.getIoTDevice.mockResolvedValueOnce({ ok: true, device: { id: "dev_1", status: "online" } });
    const ok = await request("/iot/devices/dev_1", {}, deps());
    expect(ok.status).toBe(200);
    expect((await ok.json()).device.status).toBe("online");
    expect(iot.getIoTDevice).toHaveBeenCalledWith(expect.anything(), auth, "dev_1");

    iot.getIoTDevice.mockResolvedValueOnce({ ok: false, error: "not_found" });
    const missing = await request("/iot/devices/dev_9", {}, deps());
    expect(missing.status).toBe(404);
  });

  it("DELETE /iot/devices/:id passes result.status through (404 default)", async () => {
    iot.deleteIoTDevice.mockResolvedValueOnce({ ok: true });
    const ok = await request("/iot/devices/dev_1", { method: "DELETE" }, deps());
    expect(ok.status).toBe(200);

    iot.deleteIoTDevice.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    const missing = await request("/iot/devices/dev_9", { method: "DELETE" }, deps());
    expect(missing.status).toBe(404);

    iot.deleteIoTDevice.mockResolvedValueOnce({ ok: false, error: "locked", status: 409 });
    const locked = await request("/iot/devices/dev_1", { method: "DELETE" }, deps());
    expect(locked.status).toBe(409);
    expect((await locked.json()).error).toBe("locked");
  });
});

describe("fluxy iot routes — readings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST readings with a JWT ingests for the project", async () => {
    iot.ingestIoTReading.mockResolvedValueOnce({
      ok: true,
      reading: { id: "rd_1", deviceId: "dev_1", sensor: "temp", value: 22 },
      alarms: [],
    });
    const res = await request(
      "/iot/devices/dev_1/readings",
      { method: "POST", body: { sensor: "temp", value: 22 } },
      deps(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).reading.id).toBe("rd_1");
    expect(iot.ingestIoTReading).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", {
      sensor: "temp",
      value: 22,
    });
  });

  it("POST readings accepts the device key (Bearer or X-Device-Key) for its own device", async () => {
    iot.authenticateIoTDevice.mockResolvedValueOnce({ id: "dev_1", projectId: "p9", roomId: "room_1" });
    iot.ingestIoTReading.mockResolvedValueOnce({ ok: true, reading: { id: "rd_2" }, alarms: [] });
    const res = await request(
      "/iot/devices/dev_1/readings",
      { method: "POST", body: { sensor: "temp", value: 23 }, headers: { "X-Device-Key": "iot_key" } },
      deps(),
    );
    expect(res.status).toBe(200);
    expect(iot.authenticateIoTDevice).toHaveBeenCalledWith(expect.anything(), "iot_key");
    expect(iot.ingestIoTReading).toHaveBeenCalledWith(expect.anything(), { projectId: "p9", userId: "dev_1" }, "dev_1", {
      sensor: "temp",
      value: 23,
    });
  });

  it("POST readings rejects a device key for another device without ingesting", async () => {
    iot.authenticateIoTDevice.mockResolvedValueOnce({ id: "dev_other", projectId: "p9" });
    const res = await request(
      "/iot/devices/dev_1/readings",
      { method: "POST", body: { value: 1 }, headers: { Authorization: "Bearer iot_key" } },
      deps(),
    );
    expect(res.status).toBe(401);
    expect(iot.ingestIoTReading).not.toHaveBeenCalled();
  });

  it("POST readings maps quota_exceeded to 429 with retryAfterSeconds and not_found to 404", async () => {
    iot.ingestIoTReading.mockResolvedValueOnce({
      ok: false,
      error: "quota_exceeded",
      retryAfterSeconds: 120,
    });
    const quota = await request("/iot/devices/dev_1/readings", { method: "POST", body: {} }, deps());
    expect(quota.status).toBe(429);
    expect((await quota.json()).retryAfterSeconds).toBe(120);

    iot.ingestIoTReading.mockResolvedValueOnce({ ok: false, error: "not_found" });
    const missing = await request("/iot/devices/dev_9/readings", { method: "POST", body: {} }, deps());
    expect(missing.status).toBe(404);

    iot.ingestIoTReading.mockResolvedValueOnce({ ok: false, error: "invalid_value" });
    const bad = await request("/iot/devices/dev_1/readings", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
  });

  it("GET readings maps sensor/from/to/limit and 404s on unknown device", async () => {
    iot.listIoTReadings.mockResolvedValueOnce({ ok: true, readings: [{ id: "rd_1" }] });
    const res = await request(
      "/iot/devices/dev_1/readings?sensor=temp&from=2026-01-01&to=2026-01-02&limit=10",
      {},
      deps(),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).readings).toHaveLength(1);
    expect(iot.listIoTReadings).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", {
      sensor: "temp",
      from: "2026-01-01",
      to: "2026-01-02",
      limit: "10",
    });

    iot.listIoTReadings.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/iot/devices/dev_9/readings", {}, deps())).status).toBe(404);
  });

  it("DELETE readings maps filters and 404s on unknown device", async () => {
    iot.deleteIoTReadings.mockResolvedValueOnce({ ok: true });
    const ok = await request("/iot/devices/dev_1/readings?sensor=temp", { method: "DELETE" }, deps());
    expect(ok.status).toBe(200);
    expect(iot.deleteIoTReadings).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", {
      sensor: "temp",
      from: undefined,
      to: undefined,
    });

    iot.deleteIoTReadings.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/iot/devices/dev_9/readings", { method: "DELETE" }, deps())).status).toBe(404);
  });

  it("GET readings/keys returns distinct sensors and 404s on unknown device", async () => {
    iot.listIoTReadingKeys.mockResolvedValueOnce({ ok: true, keys: ["temp", "hum"] });
    const res = await request("/iot/devices/dev_1/readings/keys", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toEqual(["temp", "hum"]);

    iot.listIoTReadingKeys.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/iot/devices/dev_9/readings/keys", {}, deps())).status).toBe(404);
  });
});

describe("fluxy iot routes — shadow & health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET shadow returns the shadow and maps not_found to 404", async () => {
    iot.getIoTShadow.mockResolvedValueOnce({
      ok: true,
      shadow: { deviceId: "dev_1", reported: { temp: 22 }, desired: { temp: 21 }, updatedAt: "t" },
    });
    const res = await request("/iot/devices/dev_1/shadow", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).shadow.desired.temp).toBe(21);

    iot.getIoTShadow.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/iot/devices/dev_9/shadow", {}, deps())).status).toBe(404);
  });

  it("PATCH shadow as member patches desired", async () => {
    iot.updateIoTDesiredShadow.mockResolvedValueOnce({
      ok: true,
      shadow: { reported: {}, desired: { setpoint: 21 } },
    });
    const res = await request(
      "/iot/devices/dev_1/shadow",
      { method: "PATCH", body: { desired: { setpoint: 21 } } },
      deps(),
    );
    expect(res.status).toBe(200);
    expect(iot.updateIoTDesiredShadow).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", {
      setpoint: 21,
    });
    expect(iot.mergeIoTReported).not.toHaveBeenCalled();

    iot.updateIoTDesiredShadow.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect(
      (await request("/iot/devices/dev_9/shadow", { method: "PATCH", body: { desired: {} } }, deps()))
        .status,
    ).toBe(404);
  });

  it("PATCH shadow with reported merges reported (member or device)", async () => {
    iot.mergeIoTReported.mockResolvedValueOnce({ ok: true, shadow: { reported: { temp: 22 }, desired: {} } });
    const member = await request(
      "/iot/devices/dev_1/shadow",
      { method: "PATCH", body: { reported: { temp: 22 } } },
      deps(),
    );
    expect(member.status).toBe(200);
    expect(iot.mergeIoTReported).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", { temp: 22 });

    iot.authenticateIoTDevice.mockResolvedValueOnce({ id: "dev_1", projectId: "p1" });
    iot.mergeIoTReported.mockResolvedValueOnce({ ok: true, shadow: { reported: { temp: 23 }, desired: {} } });
    await request(
      "/iot/devices/dev_1/shadow",
      { method: "PATCH", body: { temp: 23 }, headers: { Authorization: "Bearer iot_key" } },
      deps(),
    );
    expect(iot.mergeIoTReported).toHaveBeenLastCalledWith(
      expect.anything(),
      { projectId: "p1", userId: "dev_1", deviceAuth: true },
      "dev_1",
      { temp: 23 },
    );
    expect(iot.updateIoTDesiredShadow).not.toHaveBeenCalled();
  });

  it("GET health maps the sensor param and 404s on unknown device", async () => {
    iot.getIoTDeviceHealth.mockResolvedValueOnce({
      ok: true,
      deviceId: "dev_1",
      sensor: "temp",
      health: 92,
      sampleSize: 5,
      alerts: [],
    });
    const res = await request("/iot/devices/dev_1/health?sensor=temp", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).health).toBe(92);
    expect(iot.getIoTDeviceHealth).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", "temp");

    iot.getIoTDeviceHealth.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect((await request("/iot/devices/dev_9/health", {}, deps())).status).toBe(404);
  });
});

describe("fluxy iot routes — rpc", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET rpc pulls the oldest pending rpc (null when none)", async () => {
    iot.pullIoTRpc.mockResolvedValueOnce({ ok: true, rpc: { id: "rpc_1", method: "reboot", params: {} } });
    const res = await request("/iot/devices/dev_1/rpc", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).rpc.method).toBe("reboot");

    iot.pullIoTRpc.mockResolvedValueOnce({ ok: true, rpc: null });
    const empty = await request("/iot/devices/dev_1/rpc", {}, deps());
    expect((await empty.json()).rpc).toBeNull();
  });

  it("GET rpc/persistent lists the queue", async () => {
    iot.listPersistentIoTRpc.mockResolvedValueOnce({
      ok: true,
      rpcs: [{ id: "rpc_1", method: "reboot", status: "pending" }],
    });
    const res = await request("/iot/devices/dev_1/rpc/persistent", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).rpcs).toHaveLength(1);
    expect(iot.listPersistentIoTRpc).toHaveBeenCalledWith(expect.anything(), auth, "dev_1");
  });

  it("POST rpc creates a 201 and maps not_found to 404", async () => {
    iot.createIoTRpc.mockResolvedValueOnce({ ok: true, rpc: { id: "rpc_1", method: "reboot", status: "pending" } });
    const res = await request(
      "/iot/devices/dev_1/rpc",
      { method: "POST", body: { method: "reboot", params: { delay: 5 } } },
      deps(),
    );
    expect(res.status).toBe(201);
    expect((await res.json()).rpc.method).toBe("reboot");
    expect(iot.createIoTRpc).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", {
      method: "reboot",
      params: { delay: 5 },
    });

    iot.createIoTRpc.mockResolvedValueOnce({ ok: false, error: "not_found" });
    expect(
      (await request("/iot/devices/dev_9/rpc", { method: "POST", body: { method: "x" } }, deps())).status,
    ).toBe(404);

    iot.createIoTRpc.mockResolvedValueOnce({ ok: false, error: "method_required" });
    expect(
      (await request("/iot/devices/dev_1/rpc", { method: "POST", body: {} }, deps())).status,
    ).toBe(400);
  });

  it("POST rpc is forbidden for device keys (member-only)", async () => {
    iot.authenticateIoTDevice.mockResolvedValueOnce({ id: "dev_1", projectId: "p1" });
    const res = await request(
      "/iot/devices/dev_1/rpc",
      { method: "POST", body: { method: "reboot" }, headers: { Authorization: "Bearer iot_key" } },
      deps(),
    );
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
    expect(iot.createIoTRpc).not.toHaveBeenCalled();
  });

  it("POST rpc/:id replies with the unwrapped result and passes result.status through", async () => {
    iot.replyIoTRpc.mockResolvedValueOnce({ ok: true, id: "rpc_1", status: "replied" });
    const ok = await request(
      "/iot/devices/dev_1/rpc/rpc_1",
      { method: "POST", body: { result: { ok: true } } },
      deps(),
    );
    expect(ok.status).toBe(200);
    expect(iot.replyIoTRpc).toHaveBeenCalledWith(expect.anything(), auth, "dev_1", "rpc_1", { ok: true });

    iot.replyIoTRpc.mockResolvedValueOnce({ ok: true });
    await request("/iot/devices/dev_1/rpc/rpc_2", { method: "POST", body: { note: "raw" } }, deps());
    expect(iot.replyIoTRpc).toHaveBeenLastCalledWith(expect.anything(), auth, "dev_1", "rpc_2", {
      note: "raw",
    });

    iot.replyIoTRpc.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    const missing = await request("/iot/devices/dev_1/rpc/rpc_9", { method: "POST", body: {} }, deps());
    expect(missing.status).toBe(404);

    iot.replyIoTRpc.mockResolvedValueOnce({ ok: false, error: "nope" });
    const bad = await request("/iot/devices/dev_1/rpc/rpc_9", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
  });

  it("DELETE rpc/:id passes result.status through (404 default)", async () => {
    iot.deleteIoTRpc.mockResolvedValueOnce({ ok: true });
    expect((await request("/iot/devices/dev_1/rpc/rpc_1", { method: "DELETE" }, deps())).status).toBe(200);

    iot.deleteIoTRpc.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    expect((await request("/iot/devices/dev_1/rpc/rpc_9", { method: "DELETE" }, deps())).status).toBe(404);

    iot.deleteIoTRpc.mockResolvedValueOnce({ ok: false, error: "pending", status: 409 });
    expect((await request("/iot/devices/dev_1/rpc/rpc_2", { method: "DELETE" }, deps())).status).toBe(409);
  });
});

describe("fluxy iot routes — rules & alarms", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET /iot/rules lists, POST /iot/rules maps invalid_rule to 400", async () => {
    iot.listIoTRules.mockResolvedValueOnce({ ok: true, rules: [{ id: "rule_1", name: "hot" }] });
    const list = await request("/iot/rules", {}, deps());
    expect(list.status).toBe(200);
    expect((await list.json()).rules).toHaveLength(1);

    iot.createIoTRule.mockResolvedValueOnce({ ok: true, rule: { id: "rule_1", name: "hot" } });
    const created = await request("/iot/rules", { method: "POST", body: { name: "hot" } }, deps());
    expect(created.status).toBe(200);

    iot.createIoTRule.mockResolvedValueOnce({ ok: false, error: "invalid_rule" });
    const bad = await request("/iot/rules", { method: "POST", body: {} }, deps());
    expect(bad.status).toBe(400);
  });

  it("GET /iot/alarms maps the deviceId filter", async () => {
    iot.listIoTAlarms.mockResolvedValueOnce({ ok: true, alarms: [{ id: "alm_1", status: "active" }] });
    const res = await request("/iot/alarms?deviceId=dev_1", {}, deps());
    expect(res.status).toBe(200);
    expect((await res.json()).alarms).toHaveLength(1);
    expect(iot.listIoTAlarms).toHaveBeenCalledWith(expect.anything(), auth, { deviceId: "dev_1" });

    iot.listIoTAlarms.mockResolvedValueOnce({ ok: true, alarms: [] });
    await request("/iot/alarms", {}, deps());
    expect(iot.listIoTAlarms).toHaveBeenLastCalledWith(expect.anything(), auth, { deviceId: undefined });
  });

  it("alarm lifecycle maps status through: ack, clear, assign, unassign", async () => {
    iot.ackIoTAlarm.mockResolvedValueOnce({ ok: true, id: "alm_1", status: "acked" });
    const ack = await request("/iot/alarms/alm_1/ack", { method: "POST" }, deps());
    expect(ack.status).toBe(200);
    expect((await ack.json()).status).toBe("acked");

    iot.ackIoTAlarm.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    expect((await request("/iot/alarms/alm_9/ack", { method: "POST" }, deps())).status).toBe(404);

    iot.clearIoTAlarm.mockResolvedValueOnce({ ok: true, id: "alm_1", status: "cleared" });
    expect((await request("/iot/alarms/alm_1/clear", { method: "POST" }, deps())).status).toBe(200);

    iot.clearIoTAlarm.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    expect((await request("/iot/alarms/alm_9/clear", { method: "POST" }, deps())).status).toBe(404);

    iot.assignIoTAlarm.mockResolvedValueOnce({ ok: true, id: "alm_1", assigneeId: "u2" });
    const assigned = await request(
      "/iot/alarms/alm_1/assign",
      { method: "POST", body: { assigneeId: "u2" } },
      deps(),
    );
    expect(assigned.status).toBe(200);
    expect(iot.assignIoTAlarm).toHaveBeenCalledWith(expect.anything(), auth, "alm_1", "u2");

    iot.assignIoTAlarm.mockResolvedValueOnce({ ok: false, error: "assigneeId_required" });
    expect(
      (await request("/iot/alarms/alm_1/assign", { method: "POST", body: {} }, deps())).status,
    ).toBe(400);

    iot.unassignIoTAlarm.mockResolvedValueOnce({ ok: true, id: "alm_1", assigneeId: null });
    expect((await request("/iot/alarms/alm_1/assign", { method: "DELETE" }, deps())).status).toBe(200);

    iot.unassignIoTAlarm.mockResolvedValueOnce({ ok: false, error: "not_found", status: 404 });
    expect((await request("/iot/alarms/alm_9/assign", { method: "DELETE" }, deps())).status).toBe(404);
  });
});
