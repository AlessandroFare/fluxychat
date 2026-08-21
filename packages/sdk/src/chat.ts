/**
 * Chat-only SDK entry (`@fluxy-chat/sdk/chat`).
 * Prefer this over the main barrel when you do not need labs verticals.
 */
export * from "./core";
export { PLATFORM_READINESS, getReadinessEntry, type ReadinessEntry } from "./readiness";
