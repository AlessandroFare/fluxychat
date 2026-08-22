import { describe, expect, it } from "vitest";
import {
  WORKER_ROUTE_DISPATCHER_COUNT,
  WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY,
  WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY,
  WORKER_ROUTE_PREFIX_INDEX,
  WORKER_ROUTE_LAZY_COUNT,
  WORKER_ROUTE_EAGER_COUNT,
} from "./worker-route-dispatch.js";

describe("worker-route-dispatch (P0-2)", () => {
  it("registers the expected number of route handlers", () => {
    expect(WORKER_ROUTE_DISPATCHER_COUNT).toBe(
      WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length +
        2 +
        WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length,
    );
    expect(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length).toBeGreaterThan(100);
    expect(WORKER_ROUTE_DISPATCHERS_AFTER_PRIVACY.length).toBeGreaterThan(0);
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
  });

  it("indexes hot path prefixes without dropping rooms/messages", () => {
    expect(Object.keys(WORKER_ROUTE_PREFIX_INDEX).length).toBeGreaterThan(10);
    expect(WORKER_ROUTE_PREFIX_INDEX.rooms?.length).toBeGreaterThan(0);
    expect(WORKER_ROUTE_PREFIX_INDEX.messages?.length).toBeGreaterThan(0);
    // Prefix buckets are smaller than the full before-privacy list
    expect(WORKER_ROUTE_PREFIX_INDEX.rooms.length).toBeLessThan(
      WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length,
    );
  });

  it("keeps composite messages/agents dispatcher on /agents, /rooms, and /bots", () => {
    function names(segment) {
      return (WORKER_ROUTE_PREFIX_INDEX[segment] ?? []).map((fn) => fn.name);
    }
    expect(names("agents")).toContain("dispatchMessagesAgentsRoutes");
    expect(names("rooms")).toContain("dispatchMessagesAgentsRoutes");
    expect(names("bots")).toContain("dispatchMessagesAgentsRoutes");
  });

  it("narrows candidates for /messages vs full before-privacy list", () => {
    const messages = WORKER_ROUTE_PREFIX_INDEX.messages ?? [];
    expect(messages.length).toBeLessThan(WORKER_ROUTE_DISPATCHERS_BEFORE_PRIVACY.length);
    expect(messages.some((fn) => fn.name.includes("Messages"))).toBe(true);
  });

  it("keeps GA paths eager and still lazy-loads a large vertical set", () => {
    expect(WORKER_ROUTE_EAGER_COUNT).toBeGreaterThan(10);
    expect(WORKER_ROUTE_LAZY_COUNT).toBeGreaterThan(10);
    expect(WORKER_ROUTE_EAGER_COUNT + WORKER_ROUTE_LAZY_COUNT).toBe(
      WORKER_ROUTE_DISPATCHER_COUNT,
    );
  });
});
