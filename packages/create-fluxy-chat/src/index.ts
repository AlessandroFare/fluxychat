#!/usr/bin/env node

import { intro, log, note, outro, spinner } from "@clack/prompts";
import pc from "picocolors";
import { runPrompts } from "./prompts.js";
import {
  generateBotHandler,
  generateDevVars,
  generateEnvExample,
  generateGitignore,
  generatePackageJson,
  generateReadme,
  generateTsConfig,
  generateWorkerIndex,
  generateWranglerToml,
} from "./templates.js";
import type { AdapterType, PackageManager, ProjectConfig } from "./utils.js";
import {
  copyDir,
  detectPackageManager,
  detectPackageManagerFromLockfiles,
  installCommand,
  isAdapterType,
  isPackageManager,
  templatesDir,
  writeFile,
  writeJson,
} from "./utils.js";
import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// ----- Minimal argument parser -----

interface ParsedArgs {
  name?: string;
  adapter?: AdapterType;
  pm?: PackageManager;
  language?: "typescript" | "javascript";
  yes: boolean;
  minimal: boolean;
  skipInstall: boolean;
  noGit: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    yes: false,
    minimal: false,
    skipInstall: false,
    noGit: false,
    help: false,
  };

  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === "-h" || arg === "--help") {
      args.help = true;
    } else if (arg === "-y" || arg === "--yes") {
      args.yes = true;
    } else if (arg === "--minimal") {
      args.minimal = true;
    } else if (arg === "--skip-install") {
      args.skipInstall = true;
    } else if (arg === "--no-git") {
      args.noGit = true;
    } else if (arg === "--template" || arg === "-t") {
      const value = argv[++i];
      if (value && isAdapterType(value)) {
        args.adapter = value;
      } else if (value === "react") {
        args.adapter = "react";
      } else {
        console.error(`Invalid template: ${value}. Choose: react, basic, slack, telegram, discord, web`);
        process.exit(1);
      }
    } else if (arg === "--adapter" || arg === "-a") {
      const value = argv[++i];
      if (value && isAdapterType(value)) {
        args.adapter = value;
      } else {
        console.error(`Invalid adapter: ${value}. Choose: react, basic, slack, telegram, discord, web`);
        process.exit(1);
      }
    } else if (arg === "--pm" || arg === "--package-manager") {
      const value = argv[++i];
      if (value && isPackageManager(value)) {
        args.pm = value;
      } else {
        console.error(`Invalid package manager: ${value}. Choose: npm, pnpm, yarn`);
        process.exit(1);
      }
    } else if (arg === "--language" || arg === "-l") {
      const value = argv[++i];
      if (value === "typescript" || value === "javascript") {
        args.language = value;
      } else {
        console.error(`Invalid language: ${value}. Choose: typescript or javascript`);
        process.exit(1);
      }
    } else if (arg?.startsWith("--")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else if (arg) {
      positional.push(arg);
    }
  }

  if (positional.length > 0) {
    args.name = positional[0];
  }

  return args;
}

const HELP_TEXT = `
${pc.bold("create-fluxy-chat")} — Scaffold a new FluxyChat bot project

${pc.bold("Usage:")}
  npx create-fluxy-chat [project-name] [options]

${pc.bold("Options:")}
  -a, --adapter <type>       Adapter: react, basic, slack, telegram, discord, web
  -t, --template <type>      Alias for --adapter (e.g. react)
  --pm <manager>             Package manager: npm, pnpm, yarn
  -l, --language <lang>      Language: typescript (default) or javascript
  -y, --yes                  Skip prompts and accept defaults
  --minimal                  Chat-only widget (ui-kit) — no platform modules
  --skip-install             Skip dependency installation
  --no-git                   Skip git repository initialization
  -h, --help                 Show this help

${pc.bold("Examples:")}
  ${pc.cyan("npx create-fluxy-chat my-chat --minimal")}
  ${pc.cyan("npx create-fluxy-chat my-chat --template react")}
  ${pc.cyan("npx create-fluxy-chat my-bot --adapter basic")}
  ${pc.cyan("npx create-fluxy-chat my-bot --adapter slack")}
  ${pc.cyan("npx create-fluxy-chat my-bot --adapter telegram --pm pnpm")}
  ${pc.cyan("npx create-fluxy-chat my-bot -y --adapter discord")}
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  intro(pc.bgCyan(pc.black(" create-fluxy-chat ")));

  // Run prompts (or use flags for non-interactive mode)
  const config = await runPrompts({
    name: args.name,
    adapter: args.adapter,
    packageManager: args.pm,
    language: args.language,
    yes: args.yes,
    minimal: args.minimal,
    shouldInstall: args.skipInstall ? false : undefined,
    shouldInitGit: args.noGit ? false : undefined,
  });

  if (!config) {
    outro(pc.gray("Cancelled."));
    process.exitCode = 0;
    return;
  }

  // --- Scaffold the project ---
  const projectDir = path.resolve(process.cwd(), config.name);

  if (
    fs.existsSync(projectDir) &&
    fs.readdirSync(projectDir).length > 0
  ) {
    outro(
      pc.red(
        `Directory "${config.name}" already exists and is not empty.`,
      ),
    );
    process.exitCode = 1;
    return;
  }

  const s = spinner();
  s.start("Creating project files");

  try {
    fs.mkdirSync(projectDir, { recursive: true });

    if (config.minimal) {
      const templateRoot = path.join(templatesDir(), "minimal");
      copyDir(templateRoot, projectDir);
      const pkgPath = path.join(projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      pkg.name = config.name;
      writeJson(projectDir, "package.json", pkg);
      s.stop("Minimal chat widget created.");
    } else if (config.adapter === "react") {
      const templateRoot = path.join(templatesDir(), "react");
      copyDir(templateRoot, projectDir);
      const pkgPath = path.join(projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      pkg.name = config.name;
      writeJson(projectDir, "package.json", pkg);
      s.stop("React chat app created.");
    } else {
      // Generate package.json
      writeJson(projectDir, "package.json", generatePackageJson(config));

      // Generate tsconfig.json (for TS projects)
      if (config.language === "typescript") {
        writeJson(projectDir, "tsconfig.json", generateTsConfig());
      }

      // Generate wrangler.toml
      writeFile(projectDir, "wrangler.toml", generateWranglerToml(config));

      // Generate .dev.vars
      writeFile(projectDir, ".dev.vars", generateDevVars());

      // Generate .env.example
      writeFile(projectDir, ".env.example", generateEnvExample(config));

      // Generate .gitignore
      writeFile(projectDir, ".gitignore", generateGitignore());

      // Generate src/index.ts (worker entry point)
      const ext = config.language === "typescript" ? "ts" : "js";
      writeFile(projectDir, `src/index.${ext}`, generateWorkerIndex(config));

      // Generate src/bot.ts (bot handler)
      writeFile(projectDir, `src/bot.${ext}`, generateBotHandler(config));

      // Generate README.md
      writeFile(projectDir, "README.md", generateReadme(config));

      s.stop("Project files created.");
    }
  } catch (error) {
    s.stop("Failed to create project files.");
    throw error;
  }

  // --- Git init ---
  if (config.shouldInitGit) {
    const gitSpinner = spinner();
    gitSpinner.start("Initializing git repository");
    try {
      await execAsync("git init", { cwd: projectDir });
      gitSpinner.stop("Git repository initialized.");
    } catch {
      gitSpinner.stop("Failed to initialize git repository.");
      log.warning('Run "git init" manually in the project directory.');
    }
  }

  // --- Install dependencies ---
  if (config.shouldInstall) {
    const installSpinner = spinner();
    installSpinner.start(
      `Installing dependencies with ${config.packageManager}`,
    );
    try {
      await execAsync(installCommand(config.packageManager), {
        cwd: projectDir,
      });
      installSpinner.stop("Dependencies installed.");
    } catch {
      installSpinner.stop("Failed to install dependencies.");
      log.warning(
        `Run "${installCommand(config.packageManager)}" manually in the project directory.`,
      );
    }
  }

  // --- Next steps ---
  note(
    config.adapter === "react"
      ? [
          `cd ${config.name}`,
          "cp .env.example .env",
          "# Set VITE_FLUXYCHAT_WORKER_URL + VITE_FLUXYCHAT_PUBLIC_ROOM_ID (guest) or MEMBER_JWT",
          `${config.packageManager === "npm" ? "npm run" : config.packageManager} dev`,
        ].join("\n")
      : [
          `cd ${config.name}`,
          "cp .env.example .dev.vars",
          `${config.packageManager === "npm" ? "npm run" : config.packageManager} dev`,
        ].join("\n"),
    "Next steps",
  );

  outro(
    `${pc.green("Done!")} Visit ${pc.cyan("https://github.com/AlessandroFare/fluxychat")} for the docs.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  outro(pc.red(message));
  process.exitCode = 1;
});
