import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isFluxyConsoleHost,
  parseEnvFile,
} from "../../../../packages/create-fluxy-chat/templates/full/scripts/fluxy-doctor.mjs";

describe("fluxy-doctor helpers", () => {
  it("parseEnvFile skips comments and empty lines", () => {
    const dir = mkdtempSync(join(tmpdir(), "fluxy-doctor-"));
    const path = join(dir, ".env");
    writeFileSync(
      path,
      "# comment\nVITE_FLUXYCHAT_WORKER_URL=http://127.0.0.1:8787\n\nVITE_FLUXYCHAT_MEMBER_JWT=abc\n",
    );
    expect(parseEnvFile(path)).toEqual({
      VITE_FLUXYCHAT_WORKER_URL: "http://127.0.0.1:8787",
      VITE_FLUXYCHAT_MEMBER_JWT: "abc",
    });
  });

  it("isFluxyConsoleHost only matches fluxychat.com", () => {
    expect(isFluxyConsoleHost("https://www.fluxychat.com")).toBe(true);
    expect(isFluxyConsoleHost("https://app.fluxychat.com/onboarding")).toBe(true);
    expect(isFluxyConsoleHost("http://127.0.0.1:3000")).toBe(false);
    expect(isFluxyConsoleHost("not a url")).toBe(false);
  });
});
