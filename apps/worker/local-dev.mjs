#!/usr/bin/env node
import { Miniflare, LogMode } from "miniflare";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR = join(__dirname, ".dev-data");
const MIGRATIONS_DIR = join(__dirname, "db");

const args = process.argv.slice(2);
const shouldMigrate = args.includes("--migrate");
const shouldReset = args.includes("--reset");
const shouldSeed = args.includes("--seed");

async function run() {
  console.log("🔧 FluxyChat Local Dev Emulator (Miniflare)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (!existsSync(DB_DIR)) {
    const { mkdirSync } = await import("fs");
    mkdirSync(DB_DIR, { recursive: true });
  }

  if (shouldReset) {
    console.log("🗑️  Resetting local data...");
    const { rmSync } = await import("fs");
    if (existsSync(DB_DIR)) rmSync(DB_DIR, { recursive: true });
    mkdirSync(DB_DIR, { recursive: true });
    console.log("✅ Reset complete");
  }

  const mf = new Miniflare({
    modules: true,
    main: join(__dirname, "src/worker.js"),
    compatibilityDate: "2026-03-24",
    compatibilityFlags: ["nodejs_compat"],
    port: 8787,
    log: LogMode.INFO,
    d1Databases: [
      {
        binding: "DB",
        database_name: "fluxychat-dev",
        database_id: "dev-local-db",
      },
    ],
    kvNamespaces: [
      {
        binding: "RATE_LIMIT_KV",
        id: "dev-kv",
      },
    ],
    r2Buckets: [
      {
        binding: "ATTACHMENTS",
        bucket_name: "dev-attachments",
      },
    ],
    durableObjects: [
      {
        name: "ROOM",
        class_name: "RoomDurableObject",
      },
      {
        name: "USER",
        class_name: "UserDurableObject",
      },
      {
        name: "IP_RATE_LIMITER",
        class_name: "IpRateLimiterDurableObject",
      },
    ],
    durableObjectsSQLite: true,
    env: {
      REQUIRE_ADMIN_AUTH: "false",
      ALLOWED_ORIGINS: "http://localhost:3000,http://localhost:5173",
      AUTO_ROOM_SUMMARY_ENABLED: "false",
      DAILY_DIGEST_ENABLED: "false",
      BUILTIN_MODERATION_ENABLED: "false",
      WORKFLOW_SCHEDULES_ENABLED: "false",
      QUOTAS_ENABLED: "false",
    },
  });

  console.log("✅ Miniflare started on http://localhost:8787");

  if (shouldMigrate) {
    console.log("\n📦 Running migrations...");
    await runMigrations(mf);
  }

  if (shouldSeed) {
    console.log("\n🌱 Seeding dev data...");
    await seedData(mf);
  }

  console.log("\n📋 Available endpoints:");
  console.log("   GET  /healthz          - Health check");
  console.log("   POST /platform/bootstrap - Bootstrap platform");
  console.log("   POST /admin/rooms      - Create room");
  console.log("   POST /admin/messages   - Send message");
  console.log("   GET  /admin/ip-whitelist - IP whitelist");
  console.log("   GET  /admin/retention/policies - Retention policies");
  console.log("   GET  /admin/audit-export/schedules - Audit export");
  console.log("   GET  /admin/otel/config - OTEL config");
  console.log("   GET  /admin/presence/stats - Presence stats");
  console.log("   GET  /admin/insights/summary - Room insights");
  console.log("   GET  /admin/business-objects - Business objects");
  console.log("   GET  /admin/auctions - Live auctions");
  console.log("   GET  /admin/templates - Room templates");
  console.log("   GET  /admin/commands/stats - Command stats");

  console.log("\n💡 Tips:");
  console.log("   curl http://localhost:8787/healthz");
  console.log("   wrangler dev --local  (alternative)");
  console.log("   Ctrl+C to stop\n");

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    await mf.dispose();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    await mf.dispose();
    process.exit(0);
  });
}

async function runMigrations(mf) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf-8");
    try {
      const statements = sql.split(";").filter((s) => s.trim());
      for (const stmt of statements) {
        if (stmt.trim()) {
          await mf.env.DB.prepare(stmt.trim()).run();
        }
      }
      console.log(`   ✅ ${file}`);
    } catch (err) {
      if (err.message?.includes("already exists")) {
        console.log(`   ⏭️  ${file} (already applied)`);
      } else {
        console.log(`   ❌ ${file}: ${err.message}`);
      }
    }
  }
}

async function seedData(mf) {
  const now = new Date().toISOString();

  try {
    await mf.env.DB.prepare(
      "INSERT OR IGNORE INTO projects (id, name, created_at) VALUES (?, ?, ?)"
    ).bind("dev-project", "Dev Project", now).run();
    console.log("   ✅ Created dev-project");
  } catch (err) {
    console.log("   ⏭️  Project already exists");
  }

  try {
    await mf.env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (id, project_id, name, created_at) VALUES (?, ?, ?, ?)"
    ).bind("dev-room", "dev-project", "General", now).run();
    console.log("   ✅ Created dev-room");
  } catch (err) {
    console.log("   ⏭️  Room already exists");
  }

  try {
    await mf.env.DB.prepare(
      "INSERT OR IGNORE INTO rooms (id, project_id, name, created_at) VALUES (?, ?, ?, ?)"
    ).bind("dev-support", "dev-project", "Support", now).run();
    console.log("   ✅ Created dev-support room");
  } catch (err) {
    console.log("   ⏭️  Support room already exists");
  }
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
