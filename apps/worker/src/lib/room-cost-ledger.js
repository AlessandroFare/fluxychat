/**
 * F1 — Live marginal cost ledger for a room.
 *
 * WHY
 * ---
 * The product claim is "the only chat platform where cost is verifiable by the
 * customer". This module makes that number REAL instead of marketing: the room's
 * Durable Object measures the exact inputs Cloudflare bills on and accumulates
 * them per room, so per-room marginal cost can be shown live and priced against
 * any competitor's opaque MAU bucket.
 *
 * WHAT CLOUDFLARE BILLS ON A HIBERNATING ROOM DO
 * ----------------------------------------------
 * - Requests: every inbound WS frame counts (billed at a 20:1 ratio for WS),
 *   plus each fetch() into the DO and each alarm invocation.
 * - Duration: wall-clock while handlers execute. With hibernation active,
 *   idle connected time costs nothing — so measured handler time tracks the
 *   billed duration almost 1:1.
 * - Rows read/written: driven by our own storage/D1 statements (not counted
 *   here; too invasive). Requests + duration dominate chat workloads.
 *
 * DESIGN
 * ------
 * Pure accumulator + pricing math in this module (unit-testable); the DO owns
 * persistence and exposure. All counters are monotonic within an isolate and
 * merged additively across wakes via `merge`.
 */

/**
 * Cloudflare Workers Paid list prices (Aug 2026), USD.
 * Sources: developers.cloudflare.com/durable-objects/platform/pricing/
 */
export const CF_PRICING = Object.freeze({
  /** $0.15 per million requests (after 1M/mo included). Per-request share. */
  requestUsd: 0.15 / 1_000_000,
  /** WS inbound frames are billed at a 20:1 ratio (20 frames = 1 request). */
  wsFrameBillingDivisor: 20,
  /** $12.50 per million GB-s; a DO is metered at 128 MB => 0.128 GB. */
  gbSecondUsd: 12.5 / 1_000_000,
  gbPerDurableObject: 128 / 1024,
  /** Included monthly allowances before any charge applies. */
  includedRequestsPerMonth: 1_000_000,
  includedGbSecondsPerMonth: 400_000,
});

export function emptyLedger(nowMs = Date.now()) {
  return {
    windowStartMs: nowMs,
    lastEventMs: nowMs,
    /** Inbound WS frames processed by webSocketMessage/onMessage. */
    wsFramesIn: 0,
    /** Frames sent out to clients by broadcasts (per recipient). */
    wsFramesOut: 0,
    /** fetch() invocations handled by this DO instance. */
    doRequests: 0,
    /** Alarm firings. */
    alarms: 0,
    /** Cumulative handler execution time, milliseconds. */
    handlerDurationMs: 0,
  };
}

/** @param {ReturnType<typeof emptyLedger>} ledger */
export function recordWsFrameIn(ledger, nowMs = Date.now()) {
  ledger.wsFramesIn += 1;
  ledger.lastEventMs = nowMs;
}

/** @param {ReturnType<typeof emptyLedger>} ledger */
export function recordWsFrameOut(ledger, count = 1, nowMs = Date.now()) {
  ledger.wsFramesOut += Math.max(0, count);
  ledger.lastEventMs = nowMs;
}

/** @param {ReturnType<typeof emptyLedger>} ledger */
export function recordDoRequest(ledger, nowMs = Date.now()) {
  ledger.doRequests += 1;
  ledger.lastEventMs = nowMs;
}

/** @param {ReturnType<typeof emptyLedger>} ledger */
export function recordAlarm(ledger, nowMs = Date.now()) {
  ledger.alarms += 1;
  ledger.lastEventMs = nowMs;
}

/**
 * Time a synchronous-or-async handler body and accumulate its wall clock.
 * Returns the handler's return value untouched.
 *
 * @template T
 * @param {ReturnType<typeof emptyLedger>} ledger
 * @param {() => T} fn
 */
export async function timed(ledger, fn) {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    const delta = Date.now() - start;
    if (delta > 0) ledger.handlerDurationMs += delta;
    ledger.lastEventMs = start + delta;
  }
}

/**
 * Merge a previously persisted snapshot into the live ledger (wake recovery).
 * Counters are additive; timestamps take the earlier start / later last event.
 */
export function merge(live, snapshot) {
  if (!snapshot || typeof snapshot !== "object") return live;
  for (const k of ["wsFramesIn", "wsFramesOut", "doRequests", "alarms", "handlerDurationMs"]) {
    const v = Number(snapshot[k]);
    if (Number.isFinite(v) && v > 0) live[k] += v;
  }
  if (Number.isFinite(snapshot.windowStartMs)) {
    live.windowStartMs = Math.min(live.windowStartMs, Number(snapshot.windowStartMs));
  }
  if (Number.isFinite(snapshot.lastEventMs)) {
    live.lastEventMs = Math.max(live.lastEventMs, Number(snapshot.lastEventMs));
  }
  return live;
}

/** Billable requests: WS frames at 20:1 plus direct DO requests and alarms. */
export function billableRequests(ledger) {
  const wsRequests = Math.ceil(ledger.wsFramesIn / CF_PRICING.wsFrameBillingDivisor);
  return { wsRequests, direct: ledger.doRequests + ledger.alarms, total: wsRequests + ledger.doRequests + ledger.alarms };
}

/** Billable GB-seconds from measured handler milliseconds at 128 MB per DO. */
export function billableGbSeconds(ledger) {
  return (ledger.handlerDurationMs / 1000) * CF_PRICING.gbPerDurableObject;
}

/**
 * Convert a ledger into the customer-facing cost view.
 *
 * `monthToDate` totals (from other rooms / platform baseline) can be passed so
 * the included allowance is attributed correctly; with defaults we show the raw
 * usage-priced figure, which is the honest upper bound for one busy room.
 *
 * @param {ReturnType<typeof emptyLedger>} ledger
 * @param {{ monthRequests?: number, monthGbSeconds?: number }} [attribution]
 */
export function costView(ledger, attribution = {}) {
  const reqs = billableRequests(ledger);
  const gbSeconds = billableGbSeconds(ledger);

  const monthRequests = Number.isFinite(attribution.monthRequests)
    ? attribution.monthRequests + reqs.total
    : reqs.total;
  const extraGb = Number(attribution.monthGbSeconds);
  const monthGbSeconds = Number.isFinite(extraGb)
    ? extraGb + gbSeconds
    : gbSeconds;

  // Allowance is shared account-wide; only the portion above it is billed.
  const billedRequests = Math.max(
    0,
    monthRequests - CF_PRICING.includedRequestsPerMonth,
  );
  const billedGbSeconds = Math.max(
    0,
    monthGbSeconds - CF_PRICING.includedGbSecondsPerMonth,
  );

  const requestsUsd = billedRequests * CF_PRICING.requestUsd;
  const durationUsd = billedGbSeconds * CF_PRICING.gbSecondUsd;

  return {
    window: {
      startMs: ledger.windowStartMs,
      lastEventMs: ledger.lastEventMs,
    },
    usage: {
      wsFramesIn: ledger.wsFramesIn,
      wsFramesOut: ledger.wsFramesOut,
      doRequests: ledger.doRequests,
      alarms: ledger.alarms,
      billableRequests: reqs.total,
      handlerDurationMs: ledger.handlerDurationMs,
      gbSeconds: round(gbSeconds, 9),
    },
    estimatedUsd: {
      requests: round(requestsUsd, 9),
      duration: round(durationUsd, 9),
      total: round(requestsUsd + durationUsd, 9),
      /**
       * True when nothing above the account's included allowance was consumed
       * by this room's attribution — i.e. the honest answer is "this room
       * costs you $0 extra right now".
       */
      withinIncludedAllowance: billedRequests === 0 && billedGbSeconds === 0,
    },
    pricingVersion: "cf-2026-08",
  };
}

function round(n, digits) {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}
