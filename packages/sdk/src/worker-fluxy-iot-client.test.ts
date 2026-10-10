import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { FluxyChatClient } from "./index";
import { createWorkerFluxyIoTClient } from "./worker-fluxy-iot-client";

describe("createWorkerFluxyIoTClient", () => {
  const baseUrl = "http://127.0.0.1:8787";

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
      new Response(JSON.stringify({ readings: [{ id: "rd_1", deviceId: "dev_1", sensor: "temp", value: 21, unit: "C", timestamp: "t" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ health: 82, sampleSize: 4, alerts: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const iot = createWorkerFluxyIoTClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
    const rows = await iot.listReadings("dev_1", { sensor: "temp" });
    const health = await iot.getHealth("dev_1", "temp");
    expect(rows[0]?.value).toBe(21);
    expect(health.health).toBe(82);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/iot/devices/dev_1/readings");
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/iot/devices/dev_1/health");
  });

  it("acks an alarm and pulls RPC", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, id: "alm_1", status: "acked" }), { status: 200 }),
    );
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ rpc: { id: "rpc_1", method: "reboot", params: {} } }), { status: 200 }),
    );
    const iot = createWorkerFluxyIoTClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
    await iot.ackAlarm("alm_1");
    const rpc = await iot.pullRpc("dev_1");
    expect(rpc?.method).toBe("reboot");
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/iot/alarms/alm_1/ack");
  });

  it("clears an alarm and deletes a device", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, status: "cleared" }), { status: 200 }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const iot = createWorkerFluxyIoTClient(new FluxyChatClient({ baseUrl, userId: "u", token: "jwt" }));
    await iot.clearAlarm("alm_1");
    await iot.deleteDevice("dev_1");
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe("DELETE");
  });
});
