/**
 * Live shopping: product show overlay, MOQ/inventory, checkout deep-link tracking.
 */

import { fanoutServerEvent } from "./message-realtime-fanout.js";
import { validateExternalHttpsUrl } from "./a2a-worker.js";
import {
  createStripeLiveCheckoutSession,
  productUsesStripeCheckout,
} from "./live-stream-stripe-checkout.js";

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function mapProductRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id,
    projectId: row.project_id,
    name: row.name,
    description: row.description ?? undefined,
    imageUrl: row.image_url ?? undefined,
    checkoutUrl: row.checkout_url,
    checkoutProvider: row.checkout_provider ?? "external",
    stripePriceId: row.stripe_price_id ?? undefined,
    priceAmount: row.price_amount != null ? Number(row.price_amount) : undefined,
    currency: row.currency ?? "usd",
    active: row.active === 1,
    shownAt: row.shown_at ?? undefined,
    inventoryQty: row.inventory_qty != null ? Number(row.inventory_qty) : null,
    moq: Number(row.moq ?? 1),
    unitsSold: Number(row.units_sold ?? 0),
    createdAt: row.created_at,
  };
}

async function fanoutLiveCommerce(env, { projectId, eventId, name, userId, data }) {
  const row = await env.DB.prepare(
    "SELECT room_id FROM live_events WHERE id = ? AND project_id = ?",
  )
    .bind(eventId, projectId)
    .first();
  if (!row?.room_id) return;
  await fanoutServerEvent(env, {
    projectId,
    roomId: row.room_id,
    name,
    userId,
    data,
  }).catch(() => {});
}

export async function upsertLiveProduct(env, { projectId, eventId, productId, name, description, imageUrl, checkoutUrl, stripePriceId, checkoutProvider, priceAmount, currency, inventoryQty, moq }) {
  const event = await env.DB.prepare(
    "SELECT id FROM live_events WHERE id = ? AND project_id = ?",
  )
    .bind(eventId, projectId)
    .first();
  if (!event) return { ok: false, error: "event_not_found" };

  const useStripe =
    checkoutProvider === "stripe" ||
    Boolean(stripePriceId) ||
    (priceAmount != null && Number(priceAmount) > 0 && !checkoutUrl);

  if (useStripe && !env.STRIPE_SECRET_KEY) {
    return { ok: false, error: "stripe_not_configured" };
  }

  if (checkoutUrl && !useStripe) {
    const validated = validateExternalHttpsUrl(checkoutUrl);
    if (!validated.ok) return { ok: false, error: validated.error };
  }

  const resolvedProvider = useStripe ? "stripe" : "external";
  const resolvedCheckoutUrl = useStripe ? "" : (checkoutUrl ? String(checkoutUrl).slice(0, 500) : "");

  const id = productId || generateId("prod");
  const now = new Date().toISOString();
  const safeMoq = Math.max(1, Math.min(Number(moq) || 1, 999));
  const safeInventory = inventoryQty == null || inventoryQty === ""
    ? null
    : Math.max(0, Math.min(Number(inventoryQty), 1_000_000));

  await env.DB.prepare(
    `INSERT INTO live_stream_products
     (id, event_id, project_id, name, description, image_url, checkout_url, stripe_price_id, checkout_provider, price_amount, currency, active, inventory_qty, moq, units_sold, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       image_url = excluded.image_url,
       checkout_url = excluded.checkout_url,
       stripe_price_id = excluded.stripe_price_id,
       checkout_provider = excluded.checkout_provider,
       price_amount = excluded.price_amount,
       currency = excluded.currency,
       inventory_qty = excluded.inventory_qty,
       moq = excluded.moq`,
  )
    .bind(
      id,
      eventId,
      projectId,
      String(name || "Product").slice(0, 200),
      description ? String(description).slice(0, 500) : null,
      imageUrl ? String(imageUrl).slice(0, 500) : null,
      resolvedCheckoutUrl,
      stripePriceId ? String(stripePriceId).slice(0, 120) : null,
      resolvedProvider,
      priceAmount != null ? Number(priceAmount) : null,
      String(currency || "usd").slice(0, 8),
      safeInventory,
      safeMoq,
      now,
    )
    .run();

  const row = await env.DB.prepare(
    "SELECT * FROM live_stream_products WHERE id = ? AND project_id = ?",
  )
    .bind(id, projectId)
    .first();

  return { ok: true, product: mapProductRow(row) };
}

export async function showLiveProduct(env, { projectId, eventId, productId, userId }) {
  const row = await env.DB.prepare(
    "SELECT * FROM live_stream_products WHERE id = ? AND event_id = ? AND project_id = ?",
  )
    .bind(productId, eventId, projectId)
    .first();
  if (!row) return { ok: false, error: "product_not_found" };

  const now = new Date().toISOString();
  await env.DB.prepare(
    "UPDATE live_stream_products SET active = 0, shown_at = NULL WHERE event_id = ? AND project_id = ?",
  )
    .bind(eventId, projectId)
    .run();

  await env.DB.prepare(
    "UPDATE live_stream_products SET active = 1, shown_at = ? WHERE id = ? AND project_id = ?",
  )
    .bind(now, productId, projectId)
    .run();

  const product = mapProductRow({ ...row, active: 1, shown_at: now });
  await fanoutLiveCommerce(env, {
    projectId,
    eventId,
    name: "live.product_shown",
    userId: userId || "system",
    data: { eventId, productId, product },
  });

  return { ok: true, product };
}

export async function recordCheckoutClick(env, { projectId, eventId, productId, userId, quantity = 1, successUrl, cancelUrl }) {
  const row = await env.DB.prepare(
    "SELECT * FROM live_stream_products WHERE id = ? AND event_id = ? AND project_id = ?",
  )
    .bind(productId, eventId, projectId)
    .first();
  if (!row) return { ok: false, error: "product_not_found" };

  const qty = Math.max(1, Math.min(Number(quantity) || 1, 99));
  const moq = Math.max(1, Number(row.moq ?? 1));
  if (qty < moq) return { ok: false, error: "below_moq", moq };

  const inventoryQty = row.inventory_qty != null ? Number(row.inventory_qty) : null;
  if (inventoryQty != null && inventoryQty < qty) {
    return { ok: false, error: "insufficient_inventory", available: inventoryQty };
  }

  const now = new Date().toISOString();
  const clickId = generateId("clk");

  if (productUsesStripeCheckout(env, row)) {
    const session = await createStripeLiveCheckoutSession(env, {
      projectId,
      eventId,
      productRow: row,
      userId,
      quantity: qty,
      clickId,
      successUrl,
      cancelUrl,
    });
    if (!session.ok) return session;

    await env.DB.prepare(
      `INSERT INTO live_stream_checkout_clicks
       (id, event_id, project_id, product_id, user_id, quantity, checkout_url, stripe_checkout_session_id, payment_status, checkout_provider, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        clickId,
        eventId,
        projectId,
        productId,
        userId,
        qty,
        session.checkoutUrl,
        session.sessionId,
        "pending",
        "stripe",
        now,
      )
      .run();

    await fanoutLiveCommerce(env, {
      projectId,
      eventId,
      name: "live.checkout_click",
      userId,
      data: {
        eventId,
        productId,
        quantity: qty,
        checkoutUrl: session.checkoutUrl,
        checkoutProvider: "stripe",
        sessionId: session.sessionId,
        paymentStatus: "pending",
        unitsSold: Number(row.units_sold ?? 0),
        inventoryQty: row.inventory_qty != null ? Number(row.inventory_qty) : null,
      },
    });

    return {
      ok: true,
      clickId,
      checkoutUrl: session.checkoutUrl,
      checkoutProvider: "stripe",
      sessionId: session.sessionId,
      paymentStatus: "pending",
      quantity: qty,
      product: mapProductRow(row),
    };
  }

  const validated = validateExternalHttpsUrl(row.checkout_url);
  if (!validated.ok) return { ok: false, error: validated.error };

  if (inventoryQty != null) {
    const updated = await env.DB.prepare(
      `UPDATE live_stream_products
       SET units_sold = units_sold + ?, inventory_qty = inventory_qty - ?
       WHERE id = ? AND project_id = ? AND inventory_qty >= ?`,
    )
      .bind(qty, qty, productId, projectId, qty)
      .run();
    if (!updated.meta?.changes) {
      return { ok: false, error: "insufficient_inventory" };
    }
  } else {
    await env.DB.prepare(
      "UPDATE live_stream_products SET units_sold = units_sold + ? WHERE id = ? AND project_id = ?",
    )
      .bind(qty, productId, projectId)
      .run();
  }

  await env.DB.prepare(
    `INSERT INTO live_stream_checkout_clicks
     (id, event_id, project_id, product_id, user_id, quantity, checkout_url, payment_status, checkout_provider, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(clickId, eventId, projectId, productId, userId, qty, validated.url, "paid", "external", now)
    .run();

  const productRow = await env.DB.prepare(
    "SELECT * FROM live_stream_products WHERE id = ? AND project_id = ?",
  )
    .bind(productId, projectId)
    .first();

  await fanoutLiveCommerce(env, {
    projectId,
    eventId,
    name: "live.checkout_click",
    userId,
    data: {
      eventId,
      productId,
      quantity: qty,
      checkoutUrl: validated.url,
      unitsSold: Number(productRow?.units_sold ?? 0),
      inventoryQty: productRow?.inventory_qty != null ? Number(productRow.inventory_qty) : null,
    },
  });

  return {
    ok: true,
    clickId,
    checkoutUrl: validated.url,
    checkoutProvider: "external",
    paymentStatus: "paid",
    quantity: qty,
    product: mapProductRow(productRow),
  };
}

export { mapProductRow };
