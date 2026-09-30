"use client";

export type FluxyAgentCitation = {
  title: string;
  url?: string;
};

export type FluxyAgentApproval = {
  toolName: string;
  status: "pending" | "approved" | "denied";
};

export type FluxyAgentTurnChromeProps = {
  /** Sibling message ids this turn forked from. Widget does not store a branch graph. */
  siblingIds?: string[];
  citations?: FluxyAgentCitation[];
  reasoning?: string;
  /** Operator-facing estimate only. Not a Stripe invoice line. */
  costLabel?: string;
  approval?: FluxyAgentApproval | null;
};

/**
 * Presentational agent chrome. Parent supplies data from the room or HITL store.
 * Not a branching editor, not live usage billing, not a signing UI.
 */
export function FluxyAgentTurnChrome({
  siblingIds,
  citations,
  reasoning,
  costLabel,
  approval,
}: FluxyAgentTurnChromeProps) {
  const hasSiblings = Boolean(siblingIds?.length);
  const hasCitations = Boolean(citations?.length);
  const hasReasoning = Boolean(reasoning?.trim());
  const hasCost = Boolean(costLabel?.trim());
  const hasApproval = Boolean(approval);
  if (!hasSiblings && !hasCitations && !hasReasoning && !hasCost && !hasApproval) {
    return null;
  }

  return (
    <aside
      className="space-y-2 border-t border-border px-3 py-2 text-xs text-muted-foreground"
      aria-label="Agent turn details"
    >
      {hasSiblings ? (
        <p>
          Alternate replies: {siblingIds!.length} sibling
          {siblingIds!.length === 1 ? "" : "s"} on this parent. Open them in the thread UI.
        </p>
      ) : null}
      {hasCitations ? (
        <div>
          <p className="font-medium text-foreground">Sources</p>
          <ul className="list-disc pl-4">
            {citations!.map((c, i) => (
              <li key={`${c.title}-${i}`}>
                {c.url ? (
                  <a href={c.url} className="underline" rel="noreferrer">
                    {c.title}
                  </a>
                ) : (
                  c.title
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {hasReasoning ? (
        <details>
          <summary className="cursor-pointer font-medium text-foreground">Reasoning</summary>
          <p className="mt-1 whitespace-pre-wrap">{reasoning}</p>
        </details>
      ) : null}
      {hasCost ? <p>This turn: {costLabel}</p> : null}
      {approval ? (
        <p role="status">
          Tool {approval.toolName}: {approval.status}
          {approval.status === "pending"
            ? " — approve in the room HITL chain or one-tap link, not in this strip."
            : ""}
        </p>
      ) : null}
    </aside>
  );
}
