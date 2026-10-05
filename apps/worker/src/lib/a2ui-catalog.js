/**
 * A2UI v0.9 catalog: data-only UI. Agents may request these ids, never arbitrary HTML.
 * Mapped to @fluxy-chat/ui-kit surfaces. Buttons are attributed actions (optional quorum).
 */

export const A2UI_CATALOG_VERSION = "0.9";

export const A2UI_CATALOG = {
  Text: { uiKit: "FluxyAgentTurnChrome", interactive: false },
  Card: { uiKit: "FluxyChatWidget", interactive: false },
  Button: { uiKit: "FluxyAgentTurnChrome", interactive: true },
  ApprovalChip: { uiKit: "FluxyAgentTurnChrome", interactive: true },
  InboxRow: { uiKit: "FluxyInboxPanel", interactive: false },
};

export function validateA2uiSurface(surface) {
  if (!surface || typeof surface !== "object") return { ok: false, error: "invalid_surface" };
  const components = Array.isArray(surface.components) ? surface.components : [];
  if (!components.length || components.length > 32) return { ok: false, error: "component_limit" };
  const actions = [];
  for (const row of components) {
    const type = String(row?.type || "");
    if (!A2UI_CATALOG[type]) return { ok: false, error: "unknown_component", type };
    if (A2UI_CATALOG[type].interactive) {
      const actionId = typeof row.actionId === "string" ? row.actionId.slice(0, 64) : "";
      if (!actionId) return { ok: false, error: "action_id_required", type };
      actions.push({
        actionId,
        type,
        attributedUserId: typeof row.attributedUserId === "string" ? row.attributedUserId.slice(0, 128) : null,
        requireQuorum: row.requireQuorum === true,
        requiredAcks: Math.min(8, Math.max(1, Number(row.requiredAcks) || 1)),
      });
    }
  }
  return {
    ok: true,
    catalogVersion: A2UI_CATALOG_VERSION,
    components: components.map((row) => ({
      type: row.type,
      props: row.props && typeof row.props === "object" ? row.props : {},
      actionId: row.actionId || null,
    })),
    actions,
  };
}
