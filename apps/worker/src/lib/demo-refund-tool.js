export const REFUND_ORDER_TOOL = {
  type: "function",
  function: {
    name: "refund_order",
    description:
      "Refund an order. Always wait for human approval. After approval this records a simulated refund; it does not move money.",
    parameters: {
      type: "object",
      properties: {
        orderId: { type: "string" },
        amountEur: { type: "number" },
      },
      required: ["orderId", "amountEur"],
    },
  },
};

export function withRefundOrderTool(tools) {
  const list = Array.isArray(tools) ? [...tools] : [];
  const hasRefund = list.some((row) => row?.function?.name === "refund_order" || row?.name === "refund_order");
  if (!hasRefund) list.push(REFUND_ORDER_TOOL);
  return list;
}

export function withRefundOrderGate(gate) {
  return {
    async needsApproval(toolName, input, context) {
      if (String(toolName || "") === "refund_order") return true;
      if (!gate?.needsApproval) return false;
      return gate.needsApproval(toolName, input, context);
    },
    async shouldApprove(toolName, input, context) {
      if (gate?.shouldApprove) return gate.shouldApprove(toolName, input, context);
      return true;
    },
  };
}

export function executeDemoRefundOrder(input) {
  const orderId = String(input?.orderId || "").trim().slice(0, 64);
  const amountEur = Number(input?.amountEur);
  if (!orderId || !Number.isFinite(amountEur) || amountEur <= 0) {
    return { success: false, error: "invalid_refund_input" };
  }
  return {
    success: true,
    result: {
      simulated: true,
      orderId,
      amountEur,
      message: "Refund recorded after HITL. No money moved.",
    },
  };
}

export function mergeRefundOrderAgentFields(configRaw, toolsSchemaRaw) {
  let config = {};
  try {
    config = configRaw ? JSON.parse(configRaw) : {};
  } catch {
    config = {};
  }
  if (!config || typeof config !== "object") config = {};
  const alwaysRequire = new Set([
    ...(Array.isArray(config.approvalGate?.alwaysRequire) ? config.approvalGate.alwaysRequire : []),
    "refund_order",
  ]);
  config.approvalGate = { ...(config.approvalGate || {}), alwaysRequire: [...alwaysRequire] };

  let tools = [];
  try {
    const parsed = toolsSchemaRaw ? JSON.parse(toolsSchemaRaw) : [];
    if (Array.isArray(parsed)) tools = parsed;
  } catch {
    tools = [];
  }
  const hasRefund = tools.some((row) => row?.function?.name === "refund_order" || row?.name === "refund_order");
  if (!hasRefund) tools = [...tools, REFUND_ORDER_TOOL];

  return { config, toolsSchema: tools };
}
