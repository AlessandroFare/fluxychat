/**
 * Admin JWT gate. Default on. Disabling is allowed only in development|test.
 */
export function isAdminAuthRequired(env) {
  const raw = String(env?.REQUIRE_ADMIN_AUTH ?? "true").trim().toLowerCase();
  if (raw !== "false") return true;
  const nodeEnv = String(env?.NODE_ENV || "").trim().toLowerCase();
  return nodeEnv !== "development" && nodeEnv !== "test";
}
