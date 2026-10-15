/**
 * Builder eval corpus: many real workplace requests, not one vertical.
 * Properties checked: lint, no invented tools, writes have approval.
 */

export const OPS_EVAL_PROMPTS = [
  "When a supplier invoice arrives, check it against the order, ask accounting to review differences, and pay it after approval. Above 5000 euro two people.",
  "When an employee submits PTO, ask their manager to approve and notify HR.",
  "New hire onboarding: IT provisions accounts after security approves, then notify the manager.",
  "Customer refund over 200 euro needs finance approval then register payment.",
  "Incident P1: page on-call, wait for the commander to review, then notify engineering.",
  "Access request to production: security reviews, two-person approval, then MCP call to the IAM tool.",
  "Vendor NDA: legal reviews, guest (vendor) uploads signed copy, then file it.",
  "Expense report: extract the receipt, compare with policy docs, manager reviews, then notify finance.",
  "Support escalation: lookup the ticket view, human in support reviews, notify the customer success role.",
  "Inventory stockout: lookup inventory, procurement reviews, create a purchase via MCP.",
  "Contract renewal: search files for the MSA, legal reviews, guest (customer) comments, owner approves.",
  "Marketing campaign spend: above 10000 needs two approvals then notify finance.",
  "Data deletion request: legal reviews, security approves, then MCP to the warehouse tool.",
  "Laptop request: manager approves, IT fulfills, notify the employee.",
  "Bug bounty payout: security reviews, finance dual approval, register payment.",
  "Change window: SRE reviews, two-person approval, notify engineering.",
  "Background check: guest (candidate) uploads documents, HR reviews, notify hiring manager.",
  "Discount over 30 percent: sales manager reviews, finance approves.",
  "Warehouse return: lookup orders, warehouse role reviews, notify procurement.",
  "Policy exception: security and legal both review, then notify the requester.",
  "Office keycard: facilities reviews, security approves, MCP to badge system.",
  "Travel booking over 2000: manager then finance approval, notify the traveler.",
  "Customer churn risk: search CRM notes, CS reviews, notify account owner.",
  "Open source release: legal reviews, security approves, notify engineering.",
  "Invoice dispute: extract the invoice, lookup orders, guest (supplier) comments, accounting reviews.",
  "KPI alert: lookup named view tickets, on-call reviews, notify the owner.",
  "Training completion: HR reviews certificates from files, notify the manager.",
  "Board deck: search files, finance reviews, owner approves before notify.",
  "Suspicious login: security reviews, two-person approval, MCP to revoke session.",
  "Facilities damage report: guest (contractor) uploads photos, facilities reviews, notify finance.",
];

export function evalBuilderDrafts(draftFn, ctx) {
  const rows = [];
  for (const text of OPS_EVAL_PROMPTS) {
    const result = draftFn({ text, ...ctx });
    const tools = new Set();
    for (const step of result.definition?.steps || []) {
      if (step.tool) tools.add(step.tool);
      for (const name of step.tools || []) tools.add(name);
    }
    const enabled = new Set((ctx.tools || []).filter((t) => t.enabled !== false).map((t) => t.name));
    const invented = [...tools].filter((name) => !enabled.has(name));
    rows.push({
      text,
      ok: Boolean(result.ok || result.lint?.ok),
      invented,
      questions: result.questions || [],
      missing: result.missing || [],
      hasWrite: (result.definition?.steps || []).some((s) => s.type === "tool_call"),
      writesHaveApproval:
        !(result.definition?.steps || []).some((s) => s.type === "tool_call") ||
        (result.definition?.steps || []).some((s) => s.type === "approval"),
    });
  }
  return {
    total: rows.length,
    pass: rows.filter((row) => row.ok && !row.invented.length && row.writesHaveApproval).length,
    rows,
  };
}
