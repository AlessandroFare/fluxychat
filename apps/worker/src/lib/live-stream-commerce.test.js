import { describe, expect, it, vi } from "vitest";
import {
  mapProductRow,
  recordCheckoutClick,
  showLiveProduct,
  upsertLiveProduct,
} from "./live-stream-commerce.js";

vi.mock("./message-realtime-fanout.js", () => ({
  fanoutServerEvent: vi.fn(async () => {}),
}));

function productRow(overrides = {}) {
  return {
    id: "prod_1",
    event_id: "le_1",
    project_id: "p1",
    name: "Pro Plan",
    description: "Annual",
    image_url: null,
    checkout_url: "https://checkout.example.com/pro",
    checkout_provider: "external",
    stripe_price_id: null,
    price_amount: 9900,
    currency: "usd",
    active: 0,
    shown_at: null,
    inventory_qty: 10,
    moq: 1,
    units_sold: 0,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockEnv({ event = { room_id: "room-1" }, product = productRow() } = {}) {
  const state = { product: { ...product }, event };
  return {
    env: {
      DB: {
        prepare(sql) {
          return {
            bind(...params) {
              return {
                async first() {
                  if (sql.includes("FROM live_events")) return state.event;
                  if (sql.includes("FROM live_stream_products WHERE id")) return state.product;
                  return null;
                },
                async run() {
                  if (sql.includes("SET active = 0")) return { meta: { changes: 1 } };
                  if (sql.includes("SET active = 1")) {
                    state.product.active = 1;
                    state.product.shown_at = params[0];
                    return { meta: { changes: 1 } };
                  }
                  if (sql.includes("inventory_qty = inventory_qty -")) {
                    const qty = params[0];
                    if (state.product.inventory_qty < qty) return { meta: { changes: 0 } };
                    state.product.units_sold += qty;
                    state.product.inventory_qty -= qty;
                    return { meta: { changes: 1 } };
                  }
                  if (sql.includes("units_sold = units_sold +")) {
                    state.product.units_sold += params[0];
                    return { meta: { changes: 1 } };
                  }
                  if (sql.includes("INSERT INTO live_stream_checkout_clicks")) return { meta: { changes: 1 } };
                  if (sql.includes("INSERT INTO live_stream_products")) return { meta: { changes: 1 } };
                  return { meta: { changes: 1 } };
                },
              };
            },
          };
        },
      },
    },
    state,
  };
}

describe("live-stream-commerce", () => {
  it("mapProductRow includes inventory and moq", () => {
    const mapped = mapProductRow(productRow({ inventory_qty: 5, moq: 2, units_sold: 3 }));
    expect(mapped.inventoryQty).toBe(5);
    expect(mapped.moq).toBe(2);
    expect(mapped.unitsSold).toBe(3);
  });

  it("showLiveProduct activates product and fans out", async () => {
    const { env } = mockEnv();
    const result = await showLiveProduct(env, {
      projectId: "p1",
      eventId: "le_1",
      productId: "prod_1",
      userId: "host",
    });
    expect(result.ok).toBe(true);
    expect(result.product.active).toBe(true);
    expect(result.product.shownAt).toBeTruthy();
  });

  it("recordCheckoutClick rejects below MOQ", async () => {
    const { env } = mockEnv({ product: productRow({ moq: 3 }) });
    const result = await recordCheckoutClick(env, {
      projectId: "p1",
      eventId: "le_1",
      productId: "prod_1",
      userId: "buyer",
      quantity: 1,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("below_moq");
    expect(result.moq).toBe(3);
  });

  it("recordCheckoutClick decrements inventory and returns checkout url", async () => {
    const { env, state } = mockEnv({ product: productRow({ inventory_qty: 5 }) });
    const result = await recordCheckoutClick(env, {
      projectId: "p1",
      eventId: "le_1",
      productId: "prod_1",
      userId: "buyer",
      quantity: 2,
    });
    expect(result.ok).toBe(true);
    expect(result.checkoutUrl).toBe("https://checkout.example.com/pro");
    expect(state.product.inventory_qty).toBe(3);
    expect(state.product.units_sold).toBe(2);
  });

  it("upsertLiveProduct rejects invalid checkout url", async () => {
    const { env } = mockEnv();
    const result = await upsertLiveProduct(env, {
      projectId: "p1",
      eventId: "le_1",
      name: "Bad",
      checkoutUrl: "http://insecure.example.com/x",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("https_required");
  });
});
