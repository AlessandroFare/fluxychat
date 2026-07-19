import type { AIToolCall, AIToolContext } from "./agent-loop";
import type { AIMessage } from "./providers";

export type ToolApprovalStatus =
  | undefined
  | "not-applicable"
  | "approved"
  | "denied"
  | "user-approval"
  | ToolApprovalDecision;

export interface ToolApprovalDecision {
  type: "not-applicable" | "approved" | "denied" | "user-approval";
  reason?: string;
}

export type SingleToolApprovalFunction = (
  input: unknown,
  options: {
    toolCallId: string;
    toolName: string;
    messages?: readonly AIMessage[];
    runtime?: unknown;
  },
) => ToolApprovalStatus | Promise<ToolApprovalStatus>;

export type GenericToolApprovalFunction = (options: {
  toolCall: AIToolCall;
  messages?: readonly AIMessage[];
  runtime?: unknown;
}) => ToolApprovalStatus | Promise<ToolApprovalStatus>;

export type ToolApprovalConfig =
  | Record<string, ToolApprovalStatus | SingleToolApprovalFunction>
  | GenericToolApprovalFunction;

export function normalizeToolApprovalStatus(
  status: ToolApprovalStatus | undefined,
): ToolApprovalDecision {
  if (status === undefined) return { type: "not-applicable" };
  if (typeof status === "string") return { type: status };
  return status;
}

export async function resolveToolApproval(
  config: ToolApprovalConfig | undefined,
  toolCall: AIToolCall,
  options?: { messages?: readonly AIMessage[]; runtime?: unknown },
): Promise<Exclude<ToolApprovalStatus, string | undefined>> {
  if (!config) return { type: "not-applicable" };
  if (typeof config === "function") {
    return normalizeToolApprovalStatus(
      await config({ toolCall, messages: options?.messages, runtime: options?.runtime }),
    );
  }
  const rule = config[toolCall.name];
  if (!rule) return { type: "not-applicable" };
  if (typeof rule === "function") {
    return normalizeToolApprovalStatus(
      await rule(toolCall.input, {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        messages: options?.messages,
        runtime: options?.runtime,
      }),
    );
  }
  return normalizeToolApprovalStatus(rule);
}

let approvalCounter = 0;

export function createApprovalId(): string {
  approvalCounter += 1;
  return `apr_${Date.now()}_${approvalCounter}_${Math.random().toString(36).slice(2, 10)}`;
}

function canonicalJSON(value: unknown): string {
  if (value === null || value === undefined) return JSON.stringify(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(",")}]`;
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalJSON((value as Record<string, unknown>)[k])}`,
  );
  return `{${entries.join(",")}}`;
}

function toBase64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

const encoder = new TextEncoder();

async function hmacSha256(key: string | Uint8Array, data: Uint8Array): Promise<string> {
  const subtle = (globalThis as Record<string, unknown>).crypto as
    | { subtle?: SubtleCrypto }
    | undefined;
  if (!subtle?.subtle) {
    let hash = 0;
    const keyStr = typeof key === "string" ? key : new TextDecoder().decode(key);
    const dataStr = new TextDecoder().decode(data);
    const combined = keyStr + dataStr;
    for (let i = 0; i < combined.length; i++) {
      hash = ((hash << 5) - hash + combined.charCodeAt(i)) | 0;
    }
    return `fallback_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
  const keyBytes = typeof key === "string" ? encoder.encode(key) : key;
  const cryptoKey = await subtle.subtle.importKey(
    "raw",
    keyBytes as any,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const sig = await subtle.subtle.sign("HMAC", cryptoKey, data as any) as ArrayBuffer;
  return toBase64url(new Uint8Array(sig));
}

function buildPayload(
  approvalId: string,
  toolCallId: string,
  toolName: string,
  inputDigest: string,
): Uint8Array {
  return encoder.encode(`${approvalId}\n${toolCallId}\n${toolName}\n${inputDigest}`);
}

export async function hashCanonical(value: unknown): Promise<string> {
  const subtle = (globalThis as Record<string, unknown>).crypto as
    | { subtle?: SubtleCrypto }
    | undefined;
  if (!subtle?.subtle) {
    const str = canonicalJSON(value);
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    return `fallback_${(hash >>> 0).toString(16).padStart(8, "0")}`;
  }
  const digest = await subtle.subtle.digest("SHA-256", encoder.encode(canonicalJSON(value)) as any) as ArrayBuffer;
  return toBase64url(new Uint8Array(digest));
}

export interface ApprovalRequest {
  type: "tool-approval-request";
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
  isAutomatic?: boolean;
  signature?: string;
}

export interface ApprovalResponse {
  type: "tool-approval-response";
  approvalId: string;
  approved: boolean;
  reason?: string;
  providerExecuted?: boolean;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function signApproval(params: {
  secret: string | Uint8Array;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<string> {
  const digest = await hashCanonical(params.input);
  const payload = buildPayload(params.approvalId, params.toolCallId, params.toolName, digest);
  return hmacSha256(params.secret, payload);
}

export async function verifyApprovalSignature(params: {
  secret: string | Uint8Array;
  signature: string;
  approvalId: string;
  toolCallId: string;
  toolName: string;
  input: unknown;
}): Promise<boolean> {
  const digest = await hashCanonical(params.input);
  const payload = buildPayload(params.approvalId, params.toolCallId, params.toolName, digest);
  const expected = await hmacSha256(params.secret, payload);
  return timingSafeEqual(expected, params.signature);
}

export interface ToolApprovalRecord {
  status: "not-applicable" | "approved" | "denied" | "user-approval";
  reason?: string;
  signed?: ApprovalRequest;
}
