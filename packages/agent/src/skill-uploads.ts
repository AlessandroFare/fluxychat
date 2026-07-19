import { FluxyAIError } from "./ai-core";

export type ProviderReference = Record<string, string>;

export interface SkillFile {
  path: string;
  content: string | Uint8Array;
}

export interface SkillProvider {
  upload(files: readonly SkillFile[], options?: { displayTitle?: string }): Promise<UploadSkillResult>;
}

export interface UploadSkillOptions {
  api: SkillProvider;
  files: readonly SkillFile[];
  displayTitle?: string;
}

export interface UploadSkillResult {
  providerReference: ProviderReference;
  displayTitle?: string;
  name?: string;
  description?: string;
  latestVersion?: string;
  providerMetadata?: Record<string, unknown>;
  warnings?: Array<{ code?: string; message: string }>;
}

export async function uploadSkill(options: UploadSkillOptions): Promise<UploadSkillResult> {
  if (!options.api) throw new FluxyAIError({ code: "invalid_request", message: "Skill provider API is required.", retryable: false });
  if (!options.files?.length) throw new FluxyAIError({ code: "invalid_request", message: "At least one skill file is required.", retryable: false });
  return options.api.upload(options.files, { displayTitle: options.displayTitle });
}
