/**
 * P23-2: Human-in-the-Loop Approval
 * Gate sensitive tool calls behind human approval before execution.
 */

export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "cancelled";

export interface ApprovalRequest {
  id: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  roomId: string;
  userId: string;
  agentId: string;
  runId: string;
  /** Human-readable reason why approval is needed */
  reason?: string;
  /** ISO timestamp when the request was created */
  createdAt: string;
  /** ISO timestamp when the request expires */
  expiresAt: string;
  /** Current status */
  status: ApprovalStatus;
  /** ISO timestamp when the decision was made */
  decidedAt?: string;
  /** User who made the decision */
  decidedBy?: string;
  /** Optional note from the approver */
  note?: string;
}

export interface ApprovalStore {
  /** Create a new approval request */
  create(request: Omit<ApprovalRequest, "id" | "createdAt" | "expiresAt" | "status">): Promise<ApprovalRequest>;
  /** Get an approval request by ID */
  get(id: string): Promise<ApprovalRequest | null>;
  /** Approve a request */
  approve(id: string, userId: string, note?: string): Promise<ApprovalRequest>;
  /** Deny a request */
  deny(id: string, userId: string, note?: string): Promise<ApprovalRequest>;
  /** Get pending requests for a room */
  getPendingForRoom(roomId: string): Promise<ApprovalRequest[]>;
  /** Get pending requests for a user */
  getPendingForUser(userId: string): Promise<ApprovalRequest[]>;
}

export interface ApprovalGate {
  /** Check if a tool call needs approval */
  needsApproval(toolName: string, input: Record<string, unknown>, context: { userId: string; roomId: string }): boolean | Promise<boolean>;
  /** Custom approval function (e.g., check amount threshold) */
  shouldApprove?(toolName: string, input: Record<string, unknown>, context: { userId: string; roomId: string }): boolean | Promise<boolean>;
}

export function createApprovalStore(kv: KVNamespace): ApprovalStore {
  throw new Error("createApprovalStore not implemented in SDK - use worker runtime");
}
export function createApprovalGate(opts: {
  /** Tools that always need approval */
  alwaysRequire?: string[];
  /** Tools that never need approval */
  neverRequire?: string[];
  /** Custom gate functions per tool */
  gates?: Record<string, ApprovalGate>;
  /** Approval timeout in milliseconds (default: 5 minutes) */
  timeoutMs?: number;
}): ApprovalGate {
  throw new Error("createApprovalGate not implemented in SDK - use worker runtime");
}

interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ keys: Array<{ name: string }> }>;
}
