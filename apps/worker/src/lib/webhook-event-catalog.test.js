import { describe, expect, it } from "vitest";
import { validateWebhookEventTypes, WEBHOOK_EVENT_TYPES } from "./webhook-event-catalog.js";

describe("webhook-event-catalog", () => {
  it("accepts known event types", () => {
    expect(validateWebhookEventTypes(["message.created", "room.occupied"]).ok).toBe(true);
  });

  it("rejects unknown event types", () => {
    const result = validateWebhookEventTypes(["message.created", "not.real"]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.unknown).toContain("not.real");
  });

  it("documents at least core lifecycle events", () => {
    expect(WEBHOOK_EVENT_TYPES).toEqual(
      expect.arrayContaining(["message.created", "room.occupied", "room.vacated"]),
    );
  });
});
