/**
 * NW-201 — Decision Rooms™ product pack (GTM preset).
 * Bundles quorum decisions + debate + counterfactual + truth market links.
 * No new persistence tables — seeds message templates + returns console deep-links.
 */

export const DECISION_ROOM_PACK_ID = "decision-rooms-v1";

export const DECISION_ROOM_FEATURES = [
  {
    id: "quorum",
    label: "Async quorum decisions",
    path: "/rooms",
    description: "Propose → vote by role → decide when quorum met",
  },
  {
    id: "debate",
    label: "Multi-agent debate",
    path: "/agents/debate",
    description: "Technical, business, and risk perspectives with moderator synthesis",
  },
  {
    id: "counterfactual",
    label: "Counterfactual replay",
    path: "/agents/observability",
    description: "Branch an agent run with modified params",
  },
  {
    id: "truth_market",
    label: "Truth Market",
    path: "/truth-market",
    description: "Stake claims and dispute outcomes",
  },
];

export const DECISION_ROOM_TEMPLATES = [
  {
    name: "Decision proposal",
    body: "## Decision proposal\n**Question:** {{question}}\n**Options:** {{options}}\n**Quorum:** {{quorum}}\n\nPlease vote with 👍 / 👎 or reply with your rationale.",
  },
  {
    name: "Debate kickoff",
    body: "Kick off a multi-agent debate on: {{topic}}\nConstraints: {{constraints}}\nOpen /agents/debate to run technical + business + risk perspectives.",
  },
  {
    name: "Truth claim",
    body: "Truth Market claim: {{claim}}\nStake: {{stake}}\nOpen /truth-market to stake or dispute.",
  },
];

/**
 * @param {{ name?: string }} [opts]
 */
export function buildDecisionRoomPackPreview(opts = {}) {
  const name = String(opts.name || "Decision Room").trim() || "Decision Room";
  return {
    packId: DECISION_ROOM_PACK_ID,
    name,
    roomType: "group",
    features: DECISION_ROOM_FEATURES,
    templates: DECISION_ROOM_TEMPLATES.map((t) => ({ name: t.name, body: t.body })),
    welcomeMessage:
      `Welcome to **${name}** (Decision Rooms™ pack).\n\n` +
      `Enabled workflows:\n` +
      DECISION_ROOM_FEATURES.map((f) => `• **${f.label}** — ${f.description}`).join("\n") +
      `\n\nUse message templates for proposals, debate kickoffs, and truth claims.`,
  };
}

/**
 * Create a Decision Room + seed message templates.
 * @param {*} env
 * @param {{
 *   projectId: string,
 *   userId: string,
 *   name?: string,
 *   createRoom: (input: { name: string, type: string }) => Promise<{ id: string }>,
 *   createTemplate?: (input: { name: string, body: string }) => Promise<unknown>,
 *   postWelcome?: (roomId: string, content: string) => Promise<unknown>,
 * }} deps
 */
export async function provisionDecisionRoomPack(env, deps) {
  const preview = buildDecisionRoomPackPreview({ name: deps.name });
  const room = await deps.createRoom({
    name: preview.name,
    type: preview.roomType,
  });

  const templates = [];
  if (typeof deps.createTemplate === "function") {
    for (const t of DECISION_ROOM_TEMPLATES) {
      try {
        const row = await deps.createTemplate({
          name: `[Decision] ${t.name}`,
          body: t.body,
        });
        templates.push(row);
      } catch {
        /* non-fatal */
      }
    }
  }

  if (typeof deps.postWelcome === "function" && room?.id) {
    try {
      await deps.postWelcome(room.id, preview.welcomeMessage);
    } catch {
      /* non-fatal */
    }
  }

  return {
    ok: true,
    packId: DECISION_ROOM_PACK_ID,
    room,
    templatesCreated: templates.length,
    features: DECISION_ROOM_FEATURES,
  };
}
