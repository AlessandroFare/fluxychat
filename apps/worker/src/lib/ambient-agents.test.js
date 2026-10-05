import { describe, expect, it } from "vitest";
import {
  cronPolicyNeedsRoom,
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

  it("matches cron trigger type", () => {
    expect(
      policyMatchesEvent(
        { enabled: true, triggerType: "cron", triggerPattern: "*/15" },
        { triggerType: "cron", triggerKey: "*/15 * * * *" },
      ),
    ).toBe(true);
  });

  it("requires a room on cron policies", () => {
    expect(cronPolicyNeedsRoom("cron", "")).toBe(true);
    expect(cronPolicyNeedsRoom("cron", "room-1")).toBe(false);
    expect(cronPolicyNeedsRoom("webhook", "")).toBe(false);
  });

  it("tickAmbientCronPolicies scans cron rows", async () => {
    const { tickAmbientCronPolicies } = await import("./ambient-agents.js");
    const env = {
      DB: {
        prepare() {
          return {
            async all() {
              return { results: [] };
            },
          };
        },
      },
    };
    const out = await tickAmbientCronPolicies(env, new Date(Date.UTC(2026, 9, 3, 14, 15, 0)));
    expect(out.scanned).toBe(0);
    expect(out.fired).toBe(0);
  });
});
