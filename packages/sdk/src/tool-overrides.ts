/**
 * P22-D4: Tool override types.
 * TypeScript port of worker/src/lib/tool-overrides.js for SDK consumers.
 */

import type { ToolPreset } from "./ai-tools";

export interface ToolOverride {
  description?: string;
  title?: string;
  needsApproval?: boolean;
  enabled?: boolean;
}

export interface ToolOverridesConfig {
  profileId: string;
  projectId: string;
  overrides: Record<string, ToolOverride>;
  createdAt: string;
  updatedAt: string;
}

export interface ToolWithOverrides {
  name: string;
  description: string;
  title: string;
  inputSchema: Record<string, unknown>;
  category: "read" | "write";
  needsApproval: boolean;
}

export declare function buildToolsWithOverrides(
  preset: ToolPreset,
  overrides?: Record<string, ToolOverride>,
): ToolWithOverrides[];

export declare function getEffectiveApproval(
  preset: ToolPreset,
  toolName: string,
  overrides?: Record<string, ToolOverride>,
): boolean;

export declare function isToolEnabled(
  preset: ToolPreset,
  toolName: string,
  overrides?: Record<string, ToolOverride>,
): boolean;

export declare function validateOverride(
  toolName: string,
  override: ToolOverride,
): { valid: boolean; error?: string };
