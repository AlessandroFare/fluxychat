/**
 * P22-D1: AI tool preset definitions.
 * TypeScript port of worker/src/lib/ai-tool-presets.js for SDK consumers.
 */

export type ToolPreset = "reader" | "messenger" | "moderator";

export type ToolName =
  | "fetchMessages"
  | "fetchThread"
  | "fetchChannelMessages"
  | "listThreads"
  | "getThreadParticipants"
  | "getChannelInfo"
  | "getUser"
  | "postMessage"
  | "postChannelMessage"
  | "sendDirectMessage"
  | "editMessage"
  | "deleteMessage"
  | "addReaction"
  | "removeReaction"
  | "startTyping"
  | "subscribeThread"
  | "unsubscribeThread";

export type ChatWriteToolName =
  | "postMessage"
  | "postChannelMessage"
  | "sendDirectMessage"
  | "editMessage"
  | "deleteMessage"
  | "addReaction"
  | "removeReaction"
  | "subscribeThread"
  | "unsubscribeThread";

export type ApprovalConfig = boolean | Partial<Record<ChatWriteToolName, boolean>>;

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  category: "read" | "write";
}

export interface PresetConfig {
  tools: ToolName[];
  needsApproval: Record<string, boolean>;
}

export interface ChatBinding {
  thread(threadId: string): any;
  channel(channelId: string): any;
  getAdapter(name: string): any;
  getUser(userId: string): Promise<any | null>;
  openDM(userId: string): Promise<any>;
}

export interface ToolOverrides {
  description?: string;
  title?: string;
  needsApproval?: boolean;
  enabled?: boolean;
}

export interface ChatToolsOptions {
  chat: ChatBinding;
  preset?: ToolPreset | ToolPreset[];
  requireApproval?: ApprovalConfig;
  overrides?: Partial<Record<ToolName, ToolOverrides>>;
}

export interface ChatTool {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
  needsApproval?: boolean;
}

export const TOOL_NAMES: Record<ToolName, ToolName> = {} as any;
export const PRESETS: Record<ToolPreset, PresetConfig> = {} as any;
export const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {} as any;
export function getPresetTools(preset: ToolPreset): ToolName[] {
  throw new Error("getPresetTools not implemented in SDK - use worker runtime");
}
export function needsApproval(preset: ToolPreset, toolName: string): boolean {
  throw new Error("needsApproval not implemented in SDK - use worker runtime");
}
export function getToolDefinition(toolName: string): ToolDefinition | undefined {
  throw new Error("getToolDefinition not implemented in SDK - use worker runtime");
}
export function listPresets(): Array<{
  name: string;
  description: string;
  toolCount: number;
}> {
  throw new Error("listPresets not implemented in SDK - use worker runtime");
}
export function buildToolList(
  preset: ToolPreset,
  overrides?: {
    needsApproval?: Record<string, boolean>;
    description?: Record<string, string>;
    title?: Record<string, string>;
  },
): Array<ToolDefinition & { needsApproval: boolean; title: string }> {
  throw new Error("buildToolList not implemented in SDK - use worker runtime");
}

/**
 * Create a set of Chat tools for the Vercel AI SDK.
 * Returns a map of tool name to AI SDK tool definition with execute functions.
 */
export function createChatTools(options: ChatToolsOptions): Partial<Record<ToolName, ChatTool>> {
  throw new Error("createChatTools not implemented in SDK - use worker runtime");
}
