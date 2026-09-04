#!/usr/bin/env node
/**
 * Hosted overlay: PUT /admin/projects/:id/publish-config
 * Serializes one fluxy.hosted.json (deny, guest publish, iotAutoAgentId, rooms
 * templates + extension slots). Does not upload Worker callbacks.
 *
 *   FLUXY_WORKER_URL=https://api.fluxychat.com \
 *   FLUXY_ADMIN_JWT=eyJ... \
 *   FLUXY_PROJECT_ID=prj_... \
 *   pnpm fluxy:deploy
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const configPath = join(root, "fluxy.hosted.json");

const workerUrl = (process.env.FLUXY_WORKER_URL || process.env.VITE_FLUXYCHAT_WORKER_URL || "").replace(/\/$/, "");
const adminJwt = process.env.FLUXY_ADMIN_JWT || "";
const projectId = process.env.FLUXY_PROJECT_ID || process.env.VITE_FLUXYCHAT_PROJECT_ID || "";

function fail(msg) {
  console.error(`fluxy deploy: ${msg}`);
  process.exit(1);
}

if (!workerUrl) fail("set FLUXY_WORKER_URL");
if (!adminJwt) fail("set FLUXY_ADMIN_JWT (owner/admin JWT, not pk_)");
if (!projectId) fail("set FLUXY_PROJECT_ID");
if (!existsSync(configPath)) fail(`missing ${configPath}`);

const hosted = JSON.parse(readFileSync(configPath, "utf8"));
const body = {
  denySubstrings: Array.isArray(hosted.denySubstrings) ? hosted.denySubstrings : [],
  guestCanPublish: hosted.guestCanPublish !== false,
  iotAutoAgentId: hosted.iotAutoAgentId ?? null,
  rooms: hosted.rooms && typeof hosted.rooms === "object" ? hosted.rooms : {},
};

const url = `${workerUrl}/admin/projects/${encodeURIComponent(projectId)}/publish-config`;
const res = await fetch(url, {
  method: "PUT",
  headers: {
    Authorization: `Bearer ${adminJwt}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(body),
});
const text = await res.text();
if (!res.ok) fail(`${res.status} ${text}`);
console.log("publish-config updated");
console.log(text);
