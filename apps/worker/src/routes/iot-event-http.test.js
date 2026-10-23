/**
 * Room-scoped IoT ingest (NW-206): POST /rooms/:id/iot/events.
 * `ingestIotDeviceEvent` (message → fanout → ambient agents) is mocked here;
 * it has its own coverage in `iot-event-bus.test.js`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createAuthMatrixDeps } from "./auth-matrix-deps.js";
import { dispatchIotEventRoutes } from "./iot-event-http.js";
import * as bus from "../lib/iot-event-bus.js";
import { canAccessRoom } from "../lib/room-access.js";

vi.mock("../lib/iot-event-bus.js", () => ({ ingestIotDeviceEvent: vi.fn() }));
vi.mock("../lib/room-access.js", () => ({ canAccessRoom: vi.fn(async () => true) }));

const auth = { userId: "u1", projectId: "p1", roles: ["member"] };

function deps(overrides = {}) {
  return createAuthMatrixDeps({
    verifyJwt: async () => auth,
    ...overrides,
  });
}

function request(path, { method = "POST", body } = {}, h) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const req = new Request(`http://127.0.0.1:8787${path}`, init);
  return dispatchIotEventRoutes(req, new URL(req.url), h);
}

describe("iot room event route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(canAccessRoom).mockResolvedValue(true);
  });

  it("returns null for other paths and methods", async () => {
    expect(await request("/rooms/room_1/iot/readings", {}, deps())).toBeNull();
    expect(await request("/rooms/room_1/iot/events", { method: "GET" }, deps())).toBeNull();
    expect(await request("/iot/events", {}, deps())).toBeNull();
  });

  it("401s without a JWT", async () => {
    const res = await request("/rooms/room_1/iot/events", { body: { deviceId: "dev_1" } }, createAuthMatrixDeps());
    expect(res.status).toBe(401);
    expect(bus.ingestIotDeviceEvent).not.toHaveBeenCalled();
  });

  it("403s when the caller cannot access the room (no ingest)", async () => {
    vi.mocked(canAccessRoom).mockResolvedValueOnce(false);
    const res = await request("/rooms/room_1/iot/events", { body: { deviceId: "dev_1" } }, deps());
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("forbidden");
    expect(bus.ingestIotDeviceEvent).not.toHaveBeenCalled();
  });

  it("400s without deviceId", async () => {
    const res = await request("/rooms/room_1/iot/events", { body: {} }, deps());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("deviceId required");
    expect(bus.ingestIotDeviceEvent).not.toHaveBeenCalled();
  });

  it("201s and passes deviceId/eventType/payload/actorUserId to the bus", async () => {
    bus.ingestIotDeviceEvent.mockResolvedValueOnce({
      ok: true,
      messageId: 7,
      content: "[IoT dev_1] alarm value=90",
      ambient: { triggered: 1 },
    });
    const res = await request(
      "/rooms/room_1/iot/events",
      { body: { deviceId: "dev_1", eventType: "alarm", payload: { value: 90 }, actorUserId: "u9" } },
      deps(),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.messageId).toBe(7);
    expect(bus.ingestIotDeviceEvent).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      deviceId: "dev_1",
      eventType: "alarm",
      payload: { value: 90 },
      actorUserId: "u9",
    });
  });

  it("defaults eventType to telemetry and accepts type/data aliases", async () => {
    bus.ingestIotDeviceEvent.mockResolvedValueOnce({ ok: true, messageId: 8, content: "x" });
    const res = await request(
      "/rooms/room_1/iot/events",
      { body: { deviceId: "dev_1", type: "telemetry", data: { temp: 21 } } },
      deps(),
    );
    expect(res.status).toBe(201);
    expect(bus.ingestIotDeviceEvent).toHaveBeenCalledWith(expect.anything(), {
      projectId: "p1",
      roomId: "room_1",
      deviceId: "dev_1",
      eventType: "telemetry",
      payload: { temp: 21 },
      actorUserId: undefined,
    });
  });

  it("400s when the bus reports a missing field and 500s when it throws", async () => {
    bus.ingestIotDeviceEvent.mockResolvedValueOnce({ ok: false, error: "missing_fields" });
    const bad = await request("/rooms/room_1/iot/events", { body: { deviceId: "dev_1" } }, deps());
    expect(bad.status).toBe(400);
    expect((await bad.json()).error).toBe("missing_fields");

    const logError = vi.fn();
    bus.ingestIotDeviceEvent.mockRejectedValueOnce(new Error("boom"));
    const failed = await request("/rooms/room_1/iot/events", { body: { deviceId: "dev_1" } }, deps({ extra: { logError } }));
    expect(failed.status).toBe(500);
    expect((await failed.json()).error).toBe("internal_error");
    expect(logError).toHaveBeenCalledWith("iot.event_route_failed", expect.any(Error), expect.anything());
  });
});
