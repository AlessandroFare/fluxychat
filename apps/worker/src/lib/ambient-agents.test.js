import { describe, expect, it } from "vitest";
import {
  isPolicyCooldownActive,
  mapAgentPolicyRow,
  policyMatchesEvent,
  policyPatternMatches,
  renderAmbientPrompt,
} from "./ambient-agents.js";

describe("ambient-agents", () => {
  it("maps policy row", () => {
    const p = mapAgentPolicyRow({
      id: "apol_1",
      project_id: "p1",
      name: "Alert on outage",
      trigger_type: "webhook",
      trigger_pattern: "incident.opened",
      agent_id: "bot1",
      room_id: "room1",
      max_autonomy: "notify",
      prompt_template: null,
      enabled: 1,
      cooldown_seconds: 120,
      last_triggered_at: null,
      created_at: "2026-08-01T00:00:00Z",
      updated_at: "2026-08-01T00:00:00Z",
    });
    expect(p?.triggerType).toBe("webhook");
    expect(p?.maxAutonomy).toBe("notify");
  });

  it("matches keyword patterns", () => {
    expect(policyPatternMatches("urgent", "This is URGENT please help")).toBe(true);
    expect(policyPatternMatches("/outage/i", "major outage detected")).toBe(true);
  });

  it("matches policy to event", () => {
    const policy = {
      enabled: true,
      triggerType: "message_keyword",
      triggerPattern: "help",
    };
    expect(
      policyMatchesEvent(policy, { triggerType: "message_keyword", triggerKey: "need help now" }),
    ).toBe(true);
    expect(
      policyMatchesEvent(policy, { triggerType: "webhook", triggerKey: "help" }),
    ).toBe(false);
  });

  it("renders prompt template placeholders", () => {
    const out = renderAmbientPrompt("Event {{triggerKey}} in {{roomId}}", {
      triggerKey: "incident",
      roomId: "room-1",
    });
    expect(out).toContain("incident");
    expect(out).toContain("room-1");
  });

  it("detects cooldown", () => {
    const policy = {
      cooldownSeconds: 60,
      lastTriggeredAt: new Date().toISOString(),
    };
    expect(isPolicyCooldownActive(policy)).toBe(true);
  });
});
