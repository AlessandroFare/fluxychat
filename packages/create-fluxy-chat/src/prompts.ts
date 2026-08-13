import {
  confirm,
  isCancel,
  select,
  text,
} from "@clack/prompts";
import type { AdapterType, Language, PackageManager, ProjectConfig } from "./utils.js";
import {
  detectPackageManager,
  detectPackageManagerFromLockfiles,
  validateProjectName,
} from "./utils.js";

interface PromptInputs {
  name?: string;
  adapter?: AdapterType;
  packageManager?: PackageManager;
  language?: Language;
  yes: boolean;
  minimal?: boolean;
  shouldInstall?: boolean;
  shouldInitGit?: boolean;
}

const DEFAULT_PROJECT_NAME = "my-fluxy-bot";

/**
 * Run interactive prompts to collect project configuration.
 *
 * @param inputs - Initial values from CLI flags.
 * @returns Project config, or `null` when the user cancels.
 */
export async function runPrompts(
  inputs: PromptInputs,
): Promise<ProjectConfig | null> {
  // --- Project name ---
  let name = inputs.name;
  if (!name) {
    if (inputs.yes) {
      name = DEFAULT_PROJECT_NAME;
    } else {
      const result = await text({
        message: "Project name:",
        placeholder: DEFAULT_PROJECT_NAME,
        validate: validateProjectName,
      });
      if (isCancel(result)) return null;
      name = String(result).trim();
    }
  }

  const nameError = validateProjectName(name);
  if (nameError) {
    throw new Error(nameError);
  }

  // --- Adapter / minimal ---
  const minimal = inputs.minimal ?? false;
  let adapter = inputs.adapter;
  if (!minimal && !adapter) {
    if (inputs.yes) {
      adapter = "react";
    } else {
      const result = await select({
        message: "Select an adapter:",
        options: [
          { label: "Minimal chat widget (ui-kit, recommended)", value: "minimal" },
          { label: "React chat app (Vite + useChat)", value: "react" },
          { label: "HR anonymous feedback (compliance starter)", value: "hr-feedback" },
          { label: "Basic (Cloudflare Workers bot)", value: "basic" },
          { label: "Slack", value: "slack" },
          { label: "Telegram", value: "telegram" },
          { label: "Discord", value: "discord" },
          { label: "Web Chat", value: "web" },
        ],
      });
      if (isCancel(result)) return null;
      if (result === "minimal") {
        return runPrompts({ ...inputs, minimal: true, adapter: "react" });
      }
      adapter = result as AdapterType;
    }
  }

  // --- Language ---
  let language = inputs.language;
  if (!language) {
    if (inputs.yes) {
      language = "typescript";
    } else {
      const result = await select({
        message: "Language:",
        options: [
          { label: "TypeScript", value: "typescript" },
          { label: "JavaScript", value: "javascript" },
        ],
      });
      if (isCancel(result)) return null;
      language = result as Language;
    }
  }

  // --- Package manager ---
  let packageManager = inputs.packageManager;
  if (!packageManager) {
    const detected =
      detectPackageManagerFromLockfiles(process.cwd()) ||
      detectPackageManager(process.env.npm_config_user_agent);
    if (inputs.yes) {
      packageManager = detected;
    } else {
      const result = await select({
        message: "Package manager:",
        initialValue: detected,
        options: [
          { label: "npm", value: "npm" },
          { label: "pnpm", value: "pnpm" },
          { label: "yarn", value: "yarn" },
        ],
      });
      if (isCancel(result)) return null;
      packageManager = result as PackageManager;
    }
  }

  // --- Install dependencies ---
  const shouldInstall =
    inputs.shouldInstall ??
    (inputs.yes
      ? true
      : await confirm({
          message: "Install dependencies?",
          initialValue: true,
        }));
  if (isCancel(shouldInstall)) return null;

  // --- Git init ---
  const shouldInitGit =
    inputs.shouldInitGit ??
    (inputs.yes
      ? true
      : await confirm({
          message: "Initialize git repository?",
          initialValue: true,
        }));
  if (isCancel(shouldInitGit)) return null;

  return {
    name,
    adapter: adapter ?? "react",
    packageManager,
    language,
    shouldInstall,
    shouldInitGit,
    minimal: minimal || inputs.minimal === true,
  };
}
