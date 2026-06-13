import { describe, expect, it } from "vitest";
import {
  WORKER_ROUTE_DISPATCHER_COUNT,
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY,
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY,
} from "./worker-route-dispatch.js";

describe("worker-route-dispatch (P0-2)", () => {
  it("registers the expected number of route handlers", () => {
    expect(WORKER_ROUTE_DISPATCHER_COUNT).toBe(98);
    expect(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length).toBe(90);
    expect(WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length).toBe(6);
  });

  it("keeps GDPR/billing handlers out of the main routeDeps segments", () => {
    const names = [
      ...WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY,
      ...WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY,
    ].map((fn) => fn.name);
    expect(names).not.toContain("dispatchGdprRoutes");
    expect(names).not.toContain("dispatchBillingRoutes");
    expect(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.at(-1)?.name).toBe(
      "dispatchAgentProfilesRoutes",
    );
    expect(WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY[0]?.name).toBe(
      "dispatchRoomsMutationsRoutes",
    );
  });
});
