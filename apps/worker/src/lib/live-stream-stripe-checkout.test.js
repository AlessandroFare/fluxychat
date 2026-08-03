import { describe, expect, it, vi } from "vitest";
import {
  finalizeLiveStreamStripeCheckout,
  productUsesStripeCheckout,
} from "./live-stream-stripe-checkout.js";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutServerEvent: vi.fn(async () => {}),
}));

function stripeProduct(overrides = {}) {
  return {
    id: "prod_stripe",
    checkout_provider: "external",
    stripe_price_id: null,
    checkout_url: "",
    price_amount: 2500,
    currency: "usd",
    ...overrides,
  };
}

describe("live-stream-stripe-checkout", () => {
  it("productUsesStripeCheckout when provider is stripe and secret set", () => {
    expect(productUsesStripeCheckout({ STRIPE_SECRET_KEY: "sk_test" }, stripeProduct({ checkout_provider: "stripe" }))).toBe(true);
    expect(productUsesStripeCheckout({}, stripeProduct({ checkout_provider: "stripe" }))).toBe(false);
  });

  it("productUsesStripeCheckout when price set without external url", () => {
    expect(
      productUsesStripeCheckout(
        { STRIPE_SECRET_KEY: "sk_test" },
        stripeProduct({ checkout_provider: "external", checkout_url: "", price_amount: 1000 }),
      ),
    ).toBe(true);
  });

  it("finalizeLiveStreamStripeCheckout decrements inventory on paid", async () => {
    const click = {
      id: "clk_1",
      event_id: "le_1",
      project_id: "p1",
      product_id: "prod_stripe",
      user_id: "buyer",
      quantity: 2,
      payment_status: "pending",
      stripe_checkout_session_id: "cs_test",
    };
    const product = {
      id: "prod_stripe",
      project_id: "p1",
      inventory_qty: 5,
      units_sold: 0,
    };
    const env = {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                async first() {
                  if (sql.includes("FROM live_stream_checkout_clicks")) return click;
                  if (sql.includes("FROM live_stream_products")) return product;
                  if (sql.includes("FROM live_events")) return { room_id: "room-1" };
                  return null;
                },
                async run() {
                  if (sql.includes("inventory_qty = inventory_qty -")) {
                    const qty = params[0];
                    if (product.inventory_qty < qty) return { meta: { changes: 0 } };
                    product.units_sold += qty;
                    product.inventory_qty -= qty;
                    return { meta: { changes: 1 } };
                  }
                  if (sql.includes("UPDATE live_stream_checkout_clicks")) {
                    click.payment_status = params[0];
                    return { meta: { changes: 1 } };
                  }
                  if (sql.includes("units_sold = units_sold +")) {
                    product.units_sold += params[0];
                    return { meta: { changes: 1 } };
                  }
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    };

    const result = await finalizeLiveStreamStripeCheckout(env, {
      clickId: "clk_1",
      sessionId: "cs_test",
      paymentStatus: "paid",
    });
    expect(result.ok).toBe(true);
    expect(product.inventory_qty).toBe(3);
    expect(product.units_sold).toBe(2);
    expect(click.payment_status).toBe("paid");
  });
});
