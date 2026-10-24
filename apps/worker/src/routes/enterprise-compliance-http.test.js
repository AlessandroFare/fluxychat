import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchEnterpriseComplianceRoutes } from "./enterprise-compliance-http.js";

vi.mock("../lib/data-classification.js", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    listLabels: vi.fn(),
    createLabel: vi.fn(),
    updateLabel: vi.fn(),
    deleteLabel: vi.fn(),
    classifyRoom: vi.fn(),
    classifyMessage: vi.fn(),
    getRoomClassification: vi.fn(),
    getMessageClassifications: vi.fn(),
  };
});

import {
  classifyMessage,
  classifyRoom,
  createLabel,
  deleteLabel,
  getMessageClassifications,
  getRoomClassification,
  listLabels,
  updateLabel,
} from "../lib/data-classification.js";

function makeHandler(roles = ["admin"], overrides = {}) {
  return {
    env: {},
    json: (body, init = {}) =>
      new Response(JSON.stringify(body), {
        status: init.status || 200,
        headers: { "content-type": "application/json", ...(init.headers || {}) },
      }),
    corsHeaders: {},
    requestLogCtx: {},
    verifyJwtAndGetContext: async () => ({ projectId: "p1", userId: "u1", roles }),
    hasAnyRole: (roles, allowed) => Array.isArray(roles) && roles.some((role) => allowed.includes(role)),
    logError: vi.fn(),
    ...overrides,
  };
}

async function call(handler, method, path, body) {
  const request = new Request(`https://worker.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return dispatchEnterpriseComplianceRoutes(request, new URL(request.url), handler);
}

beforeEach(() => {
  vi.clearAllMocks();
  listLabels.mockResolvedValue([]);
  createLabel.mockResolvedValue({ id: "dcl_1", projectId: "p1", name: "Confidential", level: 2 });
  updateLabel.mockResolvedValue(null);
  deleteLabel.mockResolvedValue({ ok: false, error: "not_found" });
  classifyRoom.mockResolvedValue({ ok: false, error: "label_not_found" });
  classifyMessage.mockResolvedValue({ ok: false, error: "label_not_found" });
  getRoomClassification.mockResolvedValue(null);
  getMessageClassifications.mockResolvedValue([]);
});

describe("enterprise classification routes", () => {
  it("requires an admin JWT", async () => {
    const noAuth = makeHandler(["admin"], { verifyJwtAndGetContext: async () => null });
    expect((await call(noAuth, "GET", "/enterprise/classification/labels")).status).toBe(401);

    const member = makeHandler(["member"]);
    expect((await call(member, "GET", "/enterprise/classification/labels")).status).toBe(401);
  });

  it("returns null for unrelated paths once authenticated", async () => {
    expect(await call(makeHandler(), "GET", "/enterprise/classification-other")).toBeNull();
  });

  it("lists labels scoped to the project", async () => {
    listLabels.mockResolvedValue([{ id: "dcl_1" }]);
    const res = await call(makeHandler(), "GET", "/enterprise/classification/labels");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ labels: [{ id: "dcl_1" }], count: 1 });
    expect(listLabels).toHaveBeenCalledWith({}, { projectId: "p1" });
  });

  it("validates label create input and scopes the label to the project", async () => {
    const handler = makeHandler();
    expect((await call(handler, "POST", "/enterprise/classification/labels", {})).status).toBe(400);

    const res = await call(handler, "POST", "/enterprise/classification/labels", {
      name: "Confidential",
      level: 2,
      color: "#ff0000",
    });
    expect(res.status).toBe(201);
    expect(createLabel).toHaveBeenCalledWith({}, {
      projectId: "p1",
      name: "Confidential",
      level: 2,
      color: "#ff0000",
      description: undefined,
    });
  });

  it("maps label update and delete misses to 404", async () => {
    const handler = makeHandler();
    expect(
      (await call(handler, "PATCH", "/enterprise/classification/labels/dcl_missing", { name: "New" })).status,
    ).toBe(404);
    expect(updateLabel).toHaveBeenCalledWith({}, {
      name: "New",
      labelId: "dcl_missing",
      projectId: "p1",
    });

    updateLabel.mockResolvedValue({ id: "dcl_1", name: "New" });
    expect(
      (await call(handler, "PATCH", "/enterprise/classification/labels/dcl_1", { name: "New" })).status,
    ).toBe(200);

    expect((await call(handler, "DELETE", "/enterprise/classification/labels/dcl_1")).status).toBe(404);
    deleteLabel.mockResolvedValue({ ok: true });
    expect((await call(handler, "DELETE", "/enterprise/classification/labels/dcl_1")).status).toBe(200);
  });

  it("classifies a room with the authenticated user", async () => {
    const handler = makeHandler();
    expect(
      (await call(handler, "POST", "/enterprise/classification/rooms/r1", {})).status,
    ).toBe(400);

    expect(
      (await call(handler, "POST", "/enterprise/classification/rooms/r1", { labelId: "missing" })).status,
    ).toBe(400);

    classifyRoom.mockResolvedValue({
      ok: true,
      roomId: "r1",
      projectId: "p1",
      labelId: "dcl_1",
      classifiedBy: "u1",
    });
    const res = await call(handler, "POST", "/enterprise/classification/rooms/r1", { labelId: "dcl_1" });
    expect(res.status).toBe(201);
    expect(classifyRoom).toHaveBeenCalledWith({}, {
      projectId: "p1",
      roomId: "r1",
      labelId: "dcl_1",
      classifiedBy: "u1",
    });
  });

  it("reads a room classification", async () => {
    getRoomClassification.mockResolvedValue({ roomId: "r1", labelId: "dcl_1" });
    const res = await call(makeHandler(), "GET", "/enterprise/classification/rooms/r1");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ classification: { roomId: "r1", labelId: "dcl_1" } });
    expect(getRoomClassification).toHaveBeenCalledWith({}, { projectId: "p1", roomId: "r1" });
  });

  it("classifies a message and lists its overrides", async () => {
    const handler = makeHandler();
    expect(
      (await call(handler, "POST", "/enterprise/classification/messages/m1", {})).status,
    ).toBe(400);

    classifyMessage.mockResolvedValue({
      ok: true,
      messageId: "m1",
      projectId: "p1",
      labelId: "dcl_1",
      classifiedBy: "u1",
    });
    const res = await call(handler, "POST", "/enterprise/classification/messages/m1", { labelId: "dcl_1" });
    expect(res.status).toBe(201);
    expect(classifyMessage).toHaveBeenCalledWith({}, {
      projectId: "p1",
      messageId: "m1",
      labelId: "dcl_1",
      classifiedBy: "u1",
    });

    getMessageClassifications.mockResolvedValue([{ messageId: "m1", labelId: "dcl_1" }]);
    const list = await call(handler, "GET", "/enterprise/classification/messages/m1");
    expect(list.status).toBe(200);
    expect(await list.json()).toEqual({
      classifications: [{ messageId: "m1", labelId: "dcl_1" }],
    });
  });
});
