/**
 * A2UI v0.9 surface: catalog ids only, never HTML. Maps to @fluxy-chat/ui-kit.
 */

export const A2UI_CATALOG_VERSION = "0.9" as const;

export const A2UI_CATALOG = {
  Text: { uiKit: "FluxyAgentTurnChrome", interactive: false },
  Card: { uiKit: "FluxyChatWidget", interactive: false },
  Button: { uiKit: "FluxyAgentTurnChrome", interactive: true },
  ApprovalChip: { uiKit: "FluxyAgentTurnChrome", interactive: true },
  InboxRow: { uiKit: "FluxyInboxPanel", interactive: false },
} as const;

export type A2uiComponentType = keyof typeof A2UI_CATALOG;

export interface A2uiComponent {
  type: A2uiComponentType;
  props?: Record<string, unknown>;
  actionId?: string;
  attributedUserId?: string;
  requireQuorum?: boolean;
  requiredAcks?: number;
}

export async function postA2uiSurface(opts: {
  workerUrl: string;
  token: string;
  roomId: string;
  components: A2uiComponent[];
}): Promise<{ ok: boolean; status: number }> {
  const res = await fetch(`${opts.workerUrl.replace(/\/$/, "")}/rooms/${encodeURIComponent(opts.roomId)}/a2ui`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ components: opts.components }),
  });
  return { ok: res.ok, status: res.status };
}
