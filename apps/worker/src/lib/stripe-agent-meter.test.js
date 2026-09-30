import { describe, expect, it, vi } from "vitest";
import { reportStripeAgentTokenMeter } from "./stripe-agent-meter.js";

describe("reportStripeAgentTokenMeter", () => {
  it("skips without meter name", async () => {
    const out = await reportStripeAgentTokenMeter(
      { STRIPE_SECRET_KEY: "sk_test", STRIPE_AGENT_METER_EVENT_NAME: "" },
      { projectId: "p1", tokens: 10 },
    );
    expect(out.skipped).toBe(true);
  });

  it("posts a meter event for the project customer", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const env = {
      STRIPE_SECRET_KEY: "sk_test",
      STRIPE_AGENT_METER_EVENT_NAME: "agent_tokens",
      fetchImpl,
      DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => ({ stripe_customer_id: "cus_abc" }) };
            },
          };
        },
      },
    };
    const out = await reportStripeAgentTokenMeter(env, {
      projectId: "p1",
      tokens: 40,
      identifier: "run_1",
    });
    expect(out.ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/billing/meter_events",
      expect.objectContaining({ method: "POST" }),
    );
    const sent = fetchImpl.mock.calls[0][1].body;
    expect(String(sent)).toContain("cus_abc");
    expect(String(sent)).toContain("40");
  });
});
