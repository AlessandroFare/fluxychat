/**
 * Stripe Checkout Sessions for live-stream commerce (one-time payment).
 */

function generateId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function productUsesStripeCheckout(env, productRow) {
  if (!env?.STRIPE_SECRET_KEY) return false;
  if (productRow.checkout_provider === "stripe") return true;
  if (productRow.stripe_price_id) return true;
  if (
    productRow.price_amount != null &&
    Number(productRow.price_amount) > 0 &&
    !String(productRow.checkout_url || "").trim()
  ) {
    return true;
  }
  return false;
}

/**
 * @param {Record<string, string | number>} params
 */
function buildStripeSessionBody(params) {
  const entries = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value != null && value !== "") entries.append(key, String(value));
  }
  return entries;
}

export async function createStripeLiveCheckoutSession(env, {
  projectId,
  eventId,
  productRow,
  userId,
  quantity,
  clickId,
  successUrl,
  cancelUrl,
}) {
  const qty = Math.max(1, Math.min(Number(quantity) || 1, 99));
  const currency = String(productRow.currency || "usd").slice(0, 8).toLowerCase();
  const unitAmount = productRow.price_amount != null ? Math.round(Number(productRow.price_amount)) : null;
  const stripePriceId = productRow.stripe_price_id ? String(productRow.stripe_price_id).trim() : "";

  /** @type {Record<string, string | number>} */
  const body = {
    mode: "payment",
    "payment_method_types[]": "card",
    "line_items[0][quantity]": qty,
    success_url: successUrl || "https://app.fluxychat.com/stream?checkout=success",
    cancel_url: cancelUrl || "https://app.fluxychat.com/stream?checkout=cancelled",
    client_reference_id: clickId,
    "metadata[commerce_type]": "live_stream",
    "metadata[project_id]": projectId,
    "metadata[event_id]": eventId,
    "metadata[product_id]": productRow.id,
    "metadata[click_id]": clickId,
    "metadata[user_id]": userId,
    "metadata[quantity]": qty,
  };

  if (stripePriceId) {
    body["line_items[0][price]"] = stripePriceId;
  } else if (unitAmount != null && unitAmount > 0) {
    body["line_items[0][price_data][currency]"] = currency;
    body["line_items[0][price_data][unit_amount]"] = unitAmount;
    body["line_items[0][price_data][product_data][name]"] = String(productRow.name || "Live product").slice(0, 200);
    if (productRow.description) {
      body["line_items[0][price_data][product_data][description]"] = String(productRow.description).slice(0, 500);
    }
    if (productRow.image_url) {
      body["line_items[0][price_data][product_data][images][0]"] = String(productRow.image_url).slice(0, 500);
    }
  } else {
    return { ok: false, error: "stripe_price_required" };
  }

  const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: buildStripeSessionBody(body).toString(),
  });
  const session = await sessionRes.json();
  if (session.error) {
    return { ok: false, error: "stripe_session_failed", detail: session.error.message };
  }
  if (!session.url || !session.id) {
    return { ok: false, error: "stripe_session_invalid" };
  }
  return { ok: true, sessionId: session.id, checkoutUrl: session.url };
}

export async function finalizeLiveStreamStripeCheckout(env, { clickId, sessionId, paymentStatus = "paid" }) {
  const row = await env.DB.prepare(
    "SELECT * FROM live_stream_checkout_clicks WHERE id = ? LIMIT 1",
  )
    .bind(clickId)
    .first();
  if (!row) return { ok: false, error: "click_not_found" };
  if (row.payment_status === "paid") return { ok: true, duplicate: true, clickId };

  if (sessionId && row.stripe_checkout_session_id && row.stripe_checkout_session_id !== sessionId) {
    return { ok: false, error: "session_mismatch" };
  }

  const productRow = await env.DB.prepare(
    "SELECT * FROM live_stream_products WHERE id = ? AND project_id = ?",
  )
    .bind(row.product_id, row.project_id)
    .first();
  if (!productRow) return { ok: false, error: "product_not_found" };

  const qty = Number(row.quantity) || 1;
  const now = new Date().toISOString();

  if (paymentStatus === "paid") {
    const inventoryQty = productRow.inventory_qty != null ? Number(productRow.inventory_qty) : null;
    if (inventoryQty != null) {
      const updated = await env.DB.prepare(
        `UPDATE live_stream_products
         SET units_sold = units_sold + ?, inventory_qty = inventory_qty - ?
         WHERE id = ? AND project_id = ? AND inventory_qty >= ?`,
      )
        .bind(qty, qty, row.product_id, row.project_id, qty)
        .run();
      if (!updated.meta?.changes) {
        await env.DB.prepare(
          "UPDATE live_stream_checkout_clicks SET payment_status = ?, created_at = ? WHERE id = ?",
        )
          .bind("failed", now, clickId)
          .run();
        return { ok: false, error: "insufficient_inventory" };
      }
    } else {
      await env.DB.prepare(
        "UPDATE live_stream_products SET units_sold = units_sold + ? WHERE id = ? AND project_id = ?",
      )
        .bind(qty, row.product_id, row.project_id)
        .run();
    }
  }

  await env.DB.prepare(
    `UPDATE live_stream_checkout_clicks
     SET payment_status = ?, stripe_checkout_session_id = COALESCE(?, stripe_checkout_session_id)
     WHERE id = ?`,
  )
    .bind(paymentStatus, sessionId || null, clickId)
    .run();

  const { fanoutServerEvent } = await import("./message-realtime-fanout.js");
  const eventRow = await env.DB.prepare(
    "SELECT room_id FROM live_events WHERE id = ? AND project_id = ?",
  )
    .bind(row.event_id, row.project_id)
    .first();

  if (eventRow?.room_id && paymentStatus === "paid") {
    const productAfter = await env.DB.prepare(
      "SELECT * FROM live_stream_products WHERE id = ? AND project_id = ?",
    )
      .bind(row.product_id, row.project_id)
      .first();
    await fanoutServerEvent(env, {
      projectId: row.project_id,
      roomId: eventRow.room_id,
      name: "live.checkout_paid",
      userId: row.user_id,
      data: {
        eventId: row.event_id,
        productId: row.product_id,
        clickId,
        quantity: qty,
        sessionId: sessionId || row.stripe_checkout_session_id,
        unitsSold: Number(productAfter?.units_sold ?? 0),
        inventoryQty: productAfter?.inventory_qty != null ? Number(productAfter.inventory_qty) : null,
      },
    }).catch(() => {});
  }

  return { ok: true, clickId, paymentStatus };
}

export { generateId };
