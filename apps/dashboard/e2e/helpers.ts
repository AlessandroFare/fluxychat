import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

export function readAdminJwt(): string {
  const fromEnv = process.env.E2E_ADMIN_JWT?.trim();
  if (fromEnv) return fromEnv;
  const file = join(process.cwd(), "e2e", ".auth", "admin.jwt");
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8").trim();
}

/** Prefer `skipWithoutAdminJwt` inside `beforeEach` so collection is not skipped before globalSetup. */
export function adminJwtOrSkip(): string {
  return readAdminJwt();
}

/** Skip the current test if globalSetup did not persist a Worker JWT. */
export function skipWithoutAdminJwt(): string {
  const jwt = readAdminJwt();
  test.skip(!jwt, "No admin JWT after globalSetup (mint via /dev/provision or set E2E_ADMIN_JWT)");
  return jwt;
}

export async function ackConsole(context: BrowserContext) {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
  await context.addCookies([{ name: "fc_console_ack", value: "1", url: base }]);
}

export function readE2eProject(): { id: string; name: string } | null {
  const sessionPath = join(process.cwd(), "e2e", ".auth", "session.json");
  let projectId =
    process.env.FLUXY_CONSOLE_PROJECT_ID?.trim() ||
    process.env.FLUXY_PLATFORM_PROJECT_ID?.trim() ||
    "";
  let projectName = projectId;
  if (existsSync(sessionPath)) {
    try {
      const parsed = JSON.parse(readFileSync(sessionPath, "utf8")) as {
        projectId?: string | null;
        projectName?: string | null;
      };
      if (parsed.projectId) projectId = parsed.projectId;
      if (parsed.projectName) projectName = parsed.projectName;
    } catch {
      /* ignore */
    }
  }
  if (!projectId) {
    const jwt = readAdminJwt();
    const part = jwt.split(".")[1];
    if (part) {
      try {
        const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { tid?: string };
        if (claims.tid) projectId = claims.tid;
      } catch {
        /* ignore */
      }
    }
  }
  if (!projectId) return null;
  return { id: projectId, name: projectName || projectId };
}

function e2eSessionPayload(jwt: string) {
  const project = readE2eProject();
  return {
    adminJwt: jwt,
    memberJwt: jwt,
    activeProject: project ? { id: project.id, name: project.name, created_at: "2026-01-01T00:00:00.000Z" } : null,
    lastRoom: null,
  };
}

export async function seedAdminSession(page: Page, jwt: string) {
  const payload = e2eSessionPayload(jwt);
  await page.context().addInitScript(
    (data) => {
      window.sessionStorage.setItem("fluxychat.dashboard.session.v1", JSON.stringify(data));
      (window as Window & { __FLUXY_E2E_SESSION?: typeof data }).__FLUXY_E2E_SESSION = data;
    },
    payload,
  );

  const origin = (process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const url = page.url();
  if (url === "about:blank" || url === "" || url.startsWith("about:")) {
    try {
      await page.goto(`${origin}/`, { waitUntil: "commit" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("ERR_ABORTED") && !msg.includes("frame was detached")) throw err;
      await page.goto(`${origin}/`, { waitUntil: "commit" });
    }
    await page.evaluate(apply, payload);
  } else {
    await page.evaluate(apply, payload);
  }

  const storedJwt = await page.evaluate(() => {
    try {
      const raw = window.sessionStorage.getItem("fluxychat.dashboard.session.v1");
      return raw ? String(JSON.parse(raw).adminJwt || "") : "";
    } catch {
      return "";
    }
  });
  if (!storedJwt) {
    throw new Error("seedAdminSession: sessionStorage has no adminJwt after origin bind");
  }
}

const workerOrigin = (process.env.NEXT_PUBLIC_FLUXYCHAT_WORKER_URL ?? "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);

function isLoopbackHost(host: string): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host === "::1";
}

/** Match a Worker REST call, not the Next.js document navigation. */
export function isWorkerGet(url: string, pathname: string): boolean {
  try {
    const u = new URL(url);
    const dash = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000");
    const w = new URL(workerOrigin);
    const sameDashHost =
      u.hostname === dash.hostname || (isLoopbackHost(u.hostname) && isLoopbackHost(dash.hostname));
    if (sameDashHost && u.port === dash.port) return false;
    const path = u.pathname.replace(/\/$/, "") || "/";
    const want = pathname.replace(/\/$/, "") || "/";
    if (path !== want) return false;
    return (
      u.origin === w.origin ||
      u.port === "8787" ||
      u.port === w.port ||
      (isLoopbackHost(u.hostname) && isLoopbackHost(w.hostname) && (u.port || "80") === (w.port || "80"))
    );
  } catch {
    return false;
  }
}

/** Poll until the message list shows text (WebSocket delivery can lag). */
export async function expectMessageListContains(
  page: Page,
  text: string,
  options?: { timeoutMs?: number },
) {
  const timeout = options?.timeoutMs ?? 45_000;
  const list = page.getByTestId("message-list");
  await expect
    .poll(
      async () => {
        const content = await list.textContent();
        return content?.includes(text) ?? false;
      },
      { timeout, intervals: [250, 500, 1000, 2000] },
    )
    .toBe(true);
}

/** Click send-sample and wait for a echoed message (retries one extra send on slow WS). */
export async function sendSampleAndWaitForEcho(page: Page, userId = "alice") {
  const sendBtn = page.getByTestId("send-sample-btn");
  await expect(sendBtn).toBeEnabled({ timeout: 30_000 });

  const needle = `Hello from ${userId}`;
  await sendBtn.click();
  try {
    await expectMessageListContains(page, needle, { timeoutMs: 25_000 });
    return;
  } catch {
    await sendBtn.click();
    await expectMessageListContains(page, needle, { timeoutMs: 25_000 });
  }
}
