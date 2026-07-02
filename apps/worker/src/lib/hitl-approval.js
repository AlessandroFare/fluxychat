/**
 * P23-2: Human-in-the-Loop Approval — Worker Implementation
 * KV-backed approval store and gate for sensitive tool calls.
 */

const APPROVAL_PREFIX = "hitl-approval:";
const DEFAULT_TIMEOUT_MS = 300_000; // 5 minutes

/**
 * Create an approval store backed by Cloudflare KV.
 * @param {Object} kv - KV namespace
 */
export function createApprovalStore(kv) {
  return {
    async create(request) {
      const id = crypto.randomUUID();
      const now = new Date();
      const entry = {
        id,
        ...request,
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + DEFAULT_TIMEOUT_MS).toISOString(),
        status: "pending",
      };
      const key = `${APPROVAL_PREFIX}${id}`;
      await kv.put(key, JSON.stringify(entry), { expirationTtl: 600 });
      return entry;
    },

    async get(id) {
      const key = `${APPROVAL_PREFIX}${id}`;
      const raw = await kv.get(key, { type: "json" });
      if (!raw) return null;
      // Auto-expire
      if (raw.status === "pending" && new Date(raw.expiresAt) < new Date()) {
        raw.status = "expired";
        raw.decidedAt = new Date().toISOString();
        await kv.put(key, JSON.stringify(raw), { expirationTtl: 60 });
      }
      return raw;
    },

    async approve(id, userId, note) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Approval request not found");
      if (existing.status !== "pending") throw new Error(`Request already ${existing.status}`);
      const updated = {
        ...existing,
        status: "approved",
        decidedAt: new Date().toISOString(),
        decidedBy: userId,
        note,
      };
      const key = `${APPROVAL_PREFIX}${id}`;
      await kv.put(key, JSON.stringify(updated), { expirationTtl: 600 });
      return updated;
    },

    async deny(id, userId, note) {
      const existing = await this.get(id);
      if (!existing) throw new Error("Approval request not found");
      if (existing.status !== "pending") throw new Error(`Request already ${existing.status}`);
      const updated = {
        ...existing,
        status: "denied",
        decidedAt: new Date().toISOString(),
        decidedBy: userId,
        note,
      };
      const key = `${APPROVAL_PREFIX}${id}`;
      await kv.put(key, JSON.stringify(updated), { expirationTtl: 600 });
      return updated;
    },

    async getPendingForRoom(roomId) {
      const list = await kv.list({ prefix: APPROVAL_PREFIX });
      const results = [];
      for (const { name } of list.keys) {
        const raw = await kv.get(name, { type: "json" });
        if (raw && raw.status === "pending" && raw.roomId === roomId) {
          results.push(raw);
        }
      }
      return results;
    },

    async getPendingForUser(userId) {
      const list = await kv.list({ prefix: APPROVAL_PREFIX });
      const results = [];
      for (const { name } of list.keys) {
        const raw = await kv.get(name, { type: "json" });
        if (raw && raw.status === "pending" && raw.userId === userId) {
          results.push(raw);
        }
      }
      return results;
    },
  };
}

/**
 * Create an approval gate that determines which tools need approval.
 * @param {Object} opts
 * @param {string[]} [opts.alwaysRequire] - Tools that always need approval
 * @param {string[]} [opts.neverRequire] - Tools that never need approval
 * @param {Object} [opts.gates] - Custom gate functions per tool
 * @param {number} [opts.timeoutMs] - Approval timeout
 */
export function createApprovalGate({ alwaysRequire = [], neverRequire = [], gates = {}, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const alwaysSet = new Set(alwaysRequire);
  const neverSet = new Set(neverRequire);

  return {
    async needsApproval(toolName, input, context) {
      // Check hard-coded lists first
      if (neverSet.has(toolName)) return false;
      if (alwaysSet.has(toolName)) return true;

      // Check custom gate
      const gate = gates[toolName];
      if (gate?.needsApproval) {
        return gate.needsApproval(input, context);
      }

      // Default: no approval needed
      return false;
    },

    shouldApprove: async (toolName, input, context) => {
      const gate = gates[toolName];
      if (gate?.shouldApprove) {
        return gate.shouldApprove(input, context);
      }
      return true;
    },
  };
}

/**
 * Create a middleware that enforces approval gates on tool calls.
 * @param {Object} approvalStore - Approval store instance
 * @param {Object} approvalGate - Approval gate instance
 * @param {Object} opts - Options
 */
export function createApprovalMiddleware(approvalStore, approvalGate, opts = {}) {
  return {
    name: "hitl-approval",
    async wrapGenerate(params, next) {
      if (!params.tools) return next();

      // Check each tool call for approval requirements
      const originalNext = next;
      const wrappedNext = async () => {
        const result = await originalNext();

        // If there are tool calls, check approval
        if (result.toolCalls?.length) {
          for (const tc of result.toolCalls) {
            const input = JSON.parse(tc.arguments || "{}");
            const needsApproval = await approvalGate.needsApproval(tc.name, input, {
              userId: params.userId,
              roomId: params.roomId,
            });

            if (needsApproval) {
              // Create approval request
              const request = await approvalStore.create({
                toolName: tc.name,
                toolInput: input,
                roomId: params.roomId,
                userId: params.userId,
                agentId: params.agentId,
                runId: params.runId,
                reason: opts.reason?.(tc.name, input),
              });

              // Broadcast approval request to room
              if (opts.onApprovalRequest) {
                await opts.onApprovalRequest(request);
              }

              // Wait for approval (poll or webhook)
              const approved = await waitForApproval(approvalStore, request.id, timeoutMs);

              if (!approved) {
                // Deny the tool call
                result.toolCalls = result.toolCalls.filter((t) => t.id !== tc.id);
                result.content += `\n\n[Tool call "${tc.name}" was denied by human review]`;
              }
            }
          }
        }

        return result;
      };

      return wrappedNext();
    },
  };
}

/**
 * Wait for an approval decision by polling.
 * @param {Object} store - Approval store
 * @param {string} requestId - Request ID
 * @param {number} timeoutMs - Timeout
 */
async function waitForApproval(store, requestId, timeoutMs) {
  const start = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - start < timeoutMs) {
    const request = await store.get(requestId);
    if (!request) return false;
    if (request.status === "approved") return true;
    if (request.status === "denied" || request.status === "expired") return false;
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return false;
}
