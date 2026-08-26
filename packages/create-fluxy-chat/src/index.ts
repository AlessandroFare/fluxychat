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
  validateProjectName,
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
  full: boolean;
  mode?: "local" | "hosted";
  skipInstall: boolean;
  noGit: boolean;
  help: boolean;
  example?: string;
}

const TEMPLATE_CHOICES =
  "react, full, basic, slack, telegram, discord, web, hr-feedback";

const GALLERY_EXAMPLES = [
  "live-cursors",
  "live-cursors-chat",
  "javascript-live-cursors",
  "tiptap-room",
  "war-room",
  "iot-panel",
  "draw",
  "deal-room",
  "fleet-panel",
  "game-tick",
  "voice-stage",
  "comments-board",
  "whiteboard",
] as const;

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    yes: false,
    minimal: false,
    full: false,
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
    } else if (arg === "--full") {
      args.full = true;
      args.adapter = "full";
    } else if (arg === "--example") {
      const value = argv[++i]?.trim();
      if (!value || !GALLERY_EXAMPLES.includes(value as (typeof GALLERY_EXAMPLES)[number])) {
        console.error(`Invalid example: ${value ?? ""}. Choose: ${GALLERY_EXAMPLES.join(", ")}`);
        process.exit(1);
      }
      args.example = value;
    } else if (arg === "--mode") {
      const value = argv[++i]?.trim().toLowerCase();
      if (value === "local" || value === "hosted" || value === "self-host") {
        args.mode = value === "self-host" ? "local" : value;
        args.full = true;
        args.adapter = "full";
      } else {
        console.error(`Invalid mode: ${value}. Choose: local, self-host, hosted`);
        process.exit(1);
      }
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
      } else if (value === "hr-feedback") {
        args.adapter = "hr-feedback";
      } else {
        console.error(`Invalid template: ${value}. Choose: ${TEMPLATE_CHOICES}`);
        process.exit(1);
      }
    } else if (arg === "--adapter" || arg === "-a") {
      const value = argv[++i];
      if (value && isAdapterType(value)) {
        args.adapter = value;
      } else {
        console.error(`Invalid adapter: ${value}. Choose: ${TEMPLATE_CHOICES}`);
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
${pc.bold("create-fluxy-chat")} — Scaffold a FluxyChat app or bot worker

${pc.bold("Usage:")}
  npx @fluxy-chat/create-fluxy-chat [project-name] [options]

${pc.bold("Options:")}
  -a, --adapter <type>       Adapter: ${TEMPLATE_CHOICES}
  -t, --template <type>      Alias for --adapter (e.g. full, react)
  --pm <manager>             Package manager: npm, pnpm, yarn
  -l, --language <lang>      Language: typescript (default) or javascript
  -y, --yes                  Skip prompts and accept defaults
  --full                     Full stack: chat + @assistant + setup scripts (recommended)
  --mode <hosted|local|self-host>
                             hosted = Clerk on fluxychat.com (no wrangler)
                             local / self-host = your Worker (asks for URL + keys)
  --minimal                  Chat-only widget (ui-kit)
  --example <name>           Gallery app: ${GALLERY_EXAMPLES.join(", ")}
  --skip-install             Skip dependency installation
  --no-git                   Skip git repository initialization
  -h, --help                 Show this help

${pc.bold("Examples:")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-app --mode hosted -y")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-app --mode self-host")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-cursors --example live-cursors")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-doc --example tiptap-room")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-war --example war-room")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-iot --example iot-panel")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-chat --minimal")}
  ${pc.cyan("npx @fluxy-chat/create-fluxy-chat@latest my-bot --adapter slack")}
`;

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  intro(pc.bgCyan(pc.black(" create-fluxy-chat ")));

  if (args.example) {
    const exampleName = args.example;
    const projectName = args.name ?? `my-${exampleName}`;
    const nameError = validateProjectName(projectName);
    if (nameError) {
      outro(pc.red(nameError));
      process.exitCode = 1;
      return;
    }
    const projectDir = path.resolve(process.cwd(), projectName);
    if (fs.existsSync(projectDir) && fs.readdirSync(projectDir).length > 0) {
      outro(pc.red(`Directory "${projectName}" already exists and is not empty.`));
      process.exitCode = 1;
      return;
    }
    const s = spinner();
    s.start(`Copying example "${exampleName}"`);
    const templateRoot = path.join(templatesDir(), exampleName);
    if (!fs.existsSync(templateRoot)) {
      s.stop("Example template missing.");
      outro(pc.red(`No template at ${templateRoot}`));
      process.exitCode = 1;
      return;
    }
    fs.mkdirSync(projectDir, { recursive: true });
    copyDir(templateRoot, projectDir);
    const pkgPath = path.join(projectDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
    pkg.name = projectName;
    writeJson(projectDir, "package.json", pkg);
    s.stop(`Example "${exampleName}" created.`);

    if (!args.noGit) {
      const gitSpinner = spinner();
      gitSpinner.start("Initializing git repository");
      try {
        await execAsync("git init", { cwd: projectDir });
        gitSpinner.stop("Git repository initialized.");
      } catch {
        gitSpinner.stop("Failed to initialize git repository.");
      }
    }
    if (!args.skipInstall) {
      const pm = args.pm ?? detectPackageManager(process.env.npm_config_user_agent ?? "");
      const installSpinner = spinner();
      installSpinner.start(`Installing dependencies with ${pm}`);
      try {
        await execAsync(installCommand(pm), { cwd: projectDir });
        installSpinner.stop("Dependencies installed.");
      } catch {
        installSpinner.stop("Failed to install dependencies.");
        log.warning(`Run "${installCommand(pm)}" manually in the project directory.`);
      }
    }
    const pm = args.pm ?? detectPackageManager(process.env.npm_config_user_agent ?? "");
    const devCmd = pm === "npm" ? "npm run" : pm;
    const tryHints: Record<string, string> = {
      "tiptap-room": "# Open two tabs — type in the editor",
      "war-room": "# Open two tabs — chat; set AGENT_ID to invokeAgent",
      "iot-panel": "# Keep this tab open; curl an ingest from another terminal",
      draw: "# Open two tabs — move and click",
      "deal-room": "# Open two tabs — propose a decision and ack from both",
      "fleet-panel": "# Keep this tab open; click Post sample GPS",
      "game-tick": "# Matchmake + start, then Submit input (not netcode)",
      "voice-stage": "# Open two tabs — join speaker/listener (signaling, not WebRTC)",
      "comments-board": "# Click the canvas to pin a thread",
      "live-cursors-chat": "# Open two tabs — move and chat",
      whiteboard: "# Open two tabs — draw strokes (Yjs, not a second CRDT)",
    };
    const tryHint = tryHints[exampleName] ?? "# Open two tabs — move the pointer";
    note(
      [
        `cd ${projectName}`,
        "cp .env.example .env",
        "# Set VITE_FLUXYCHAT_WORKER_URL + public room ID or member JWT",
        `${devCmd} dev`,
        tryHint,
      ].join("\n"),
      "Next steps",
    );
    outro(`${pc.green("Done!")} Visit ${pc.cyan("https://docs.fluxychat.com/llms.txt")}`);
    return;
  }

  // Run prompts (or use flags for non-interactive mode)
  const config = await runPrompts({
    name: args.name,
    adapter: args.adapter,
    packageManager: args.pm,
    language: args.language,
    yes: args.yes,
    minimal: args.minimal,
    full: args.full,
    mode: args.mode,
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
    } else if (config.full || config.adapter === "full") {
      const templateRoot = path.join(templatesDir(), "full");
      copyDir(templateRoot, projectDir);
      const pkgPath = path.join(projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      pkg.name = config.name;
      writeJson(projectDir, "package.json", pkg);
      if (config.full || config.adapter === "full") {
        fs.mkdirSync(path.join(projectDir, ".fluxy"), { recursive: true });
        const setupMode = config.mode === "hosted" ? "hosted" : "local";
        writeFile(projectDir, ".fluxy/mode", `${setupMode}\n`);
        writeFile(
          projectDir,
          ".fluxy/answers.json",
          `${JSON.stringify(
            {
              mode: setupMode,
              workerUrl: config.workerUrl ?? null,
              consoleUrl: config.consoleUrl ?? null,
              createdAt: new Date().toISOString(),
            },
            null,
            2,
          )}\n`,
        );
        if (setupMode === "local") {
          const groqLine = config.groqApiKey
            ? `GROQ_API_KEY=${config.groqApiKey}`
            : "# GROQ_API_KEY=";
          writeFile(
            projectDir,
            ".fluxy/worker.dev.vars",
            [
              "# Merge into fluxychat/apps/worker/.dev.vars (or paste after clone).",
              "# Member JWTs are per-project in D1. This signing key is for bootstrap/secrets.",
              "ALLOW_DEV_PROVISION=true",
              `JWT_SIGNING_KEY=${config.jwtSigningKey ?? ""}`,
              groqLine,
              "AI_MODEL=openai/gpt-oss-20b",
              "",
            ].join("\n"),
          );
        }
      }
      s.stop(
        config.mode === "hosted"
          ? "Full stack app created (hosted mode — run pnpm setup:hosted)."
          : "Full stack app created (chat + agent + setup scripts).",
      );
    } else if (config.adapter === "react") {
      const templateRoot = path.join(templatesDir(), "react");
      copyDir(templateRoot, projectDir);
      const pkgPath = path.join(projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      pkg.name = config.name;
      writeJson(projectDir, "package.json", pkg);
      s.stop("React chat app created.");
    } else if (config.adapter === "hr-feedback") {
      const templateRoot = path.join(templatesDir(), "hr-feedback");
      copyDir(templateRoot, projectDir);
      const pkgPath = path.join(projectDir, "package.json");
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as Record<string, unknown>;
      pkg.name = config.name;
      writeJson(projectDir, "package.json", pkg);
      s.stop("HR feedback starter created.");
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
  const devCmd = config.packageManager === "npm" ? "npm run" : config.packageManager;
  const nextSteps =
    config.full || config.adapter === "full"
      ? config.mode === "hosted"
        ? [
            `cd ${config.name}`,
            `${devCmd} setup:hosted   # guest JWT from fluxychat.com`,
            `${devCmd} dev            # http://localhost:5173`,
            `# Keep this project: https://fluxychat.com/onboarding?from=cli`,
          ].join("\n")
        : [
            `cd ${config.name}`,
            `# 1. Clone FluxyChat and run: pnpm run self-host`,
            `#    Merge .fluxy/worker.dev.vars into apps/worker/.dev.vars`,
            `# 2. Start Worker: pnpm --filter @fluxy-chat/worker dev`,
            `${devCmd} setup:local   # POST /dev/provision → writes .env`,
            `${devCmd} dev           # http://localhost:5173`,
          ].join("\n")
      : config.adapter === "react" || config.minimal
        ? [
            `cd ${config.name}`,
            "cp .env.example .env",
            "# Set VITE_FLUXYCHAT_WORKER_URL + JWT or public room ID",
            `${devCmd} dev`,
            "# In the room, send: @assistant hello",
          ].join("\n")
        : [
            `cd ${config.name}`,
            "cp .env.example .dev.vars",
            `${devCmd} dev`,
          ].join("\n");

  note(nextSteps, "Next steps");

  outro(
    `${pc.green("Done!")} Visit ${pc.cyan("https://github.com/AlessandroFare/fluxychat")} for the docs.`,
  );
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  outro(pc.red(message));
  process.exitCode = 1;
});
