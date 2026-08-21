import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Supported package managers.
 */
export type PackageManager = "npm" | "yarn" | "pnpm";

/**
 * Supported adapter types.
 */
export type AdapterType = "basic" | "slack" | "telegram" | "discord" | "web" | "react" | "hr-feedback" | "full";

/**
 * Supported language options.
 */
export type Language = "typescript" | "javascript";

/**
 * Resolved project configuration.
 */
export interface ProjectConfig {
  name: string;
  adapter: AdapterType;
  packageManager: PackageManager;
  language: Language;
  shouldInstall: boolean;
  shouldInitGit: boolean;
  /** Chat-only widget template (ui-kit) — progressive disclosure */
  minimal?: boolean;
  /** Full stack: chat + agent + setup scripts */
  full?: boolean;
  /** Setup target: local/self-host worker or hosted cloud */
  mode?: "local" | "hosted";
  workerUrl?: string;
  consoleUrl?: string;
  groqApiKey?: string;
  jwtSigningKey?: string;
}

const PACKAGE_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;

const PACKAGE_MANAGERS = new Set(["npm", "yarn", "pnpm"]);

/**
 * Validate a project name as an npm package name.
 */
export function validateProjectName(
  value: string | undefined,
): string | undefined {
  const name = value?.trim() ?? "";
  if (!name) {
    return "Project name is required";
  }
  if (
    name.startsWith(".") ||
    name.startsWith("_") ||
    name.includes("..") ||
    !PACKAGE_NAME_PATTERN.test(name)
  ) {
    return "Use a valid npm package name (unscoped), like my-bot";
  }
}

/**
 * Check whether a string is a supported package manager.
 */
export function isPackageManager(value: string): value is PackageManager {
  return PACKAGE_MANAGERS.has(value);
}

/**
 * Check whether a string is a supported adapter type.
 */
export function isAdapterType(value: string): value is AdapterType {
  return ["basic", "slack", "telegram", "discord", "web", "react", "hr-feedback", "full"].includes(value);
}

/**
 * Detect the current package manager from lockfiles in the target directory.
 */
export function detectPackageManagerFromLockfiles(
  cwd: string,
): PackageManager {
  if (fs.existsSync(path.join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }
  if (fs.existsSync(path.join(cwd, "yarn.lock"))) {
    return "yarn";
  }
  return "npm";
}

/**
 * Detect the current package manager from npm's user-agent environment value.
 */
export function detectPackageManager(userAgent = ""): PackageManager {
  if (userAgent.startsWith("pnpm")) {
    return "pnpm";
  }
  if (userAgent.startsWith("yarn")) {
    return "yarn";
  }
  return "npm";
}

/**
 * Get the install command for a package manager.
 */
export function installCommand(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn install";
    default:
      return "npm install";
  }
}

/**
 * Get the dev command for a package manager.
 */
export function devCommand(pm: PackageManager): string {
  switch (pm) {
    case "pnpm":
      return "pnpm dev";
    case "yarn":
      return "yarn dev";
    default:
      return "npm run dev";
  }
}

/**
 * Write a file, creating parent directories first.
 */
export function writeFile(
  projectDir: string,
  filePath: string,
  content: string,
): void {
  const fullPath = path.join(projectDir, filePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
}

/**
 * Write a JSON file with 2-space indentation.
 */
export function writeJson(
  projectDir: string,
  filePath: string,
  value: unknown,
): void {
  writeFile(projectDir, filePath, `${JSON.stringify(value, null, 2)}\n`);
}

/**
 * Recursively copy a directory.
 */
export function copyDir(source: string, destination: string): void {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const srcPath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Resolve the templates directory path.
 */
export function templatesDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "templates");
}
