/**
 * Stripe inbound webhook (POST /webhooks/stripe).
 * @returns {Promise<Response|null>}
 */
import { pickRouteDeps } from "./route-http-deps.js";
import { handleStripeWebhookPost } from "../lib/stripe-billing.js";

export async function dispatchStripeWebhookRoutes(request, url, h) {
  const { env, json, logError, logInfo } = pickRouteDeps(h, [
    "env",
    "json",
    "logError",
    "logInfo",
  ]);

  if (url.pathname === "/webhooks/stripe" && request.method === "POST") {
    return handleStripeWebhookPost(request, env, { json, logError, logInfo });
  }

  return null;
}
