import { describe, expect, it } from "vitest";
import { parseCliEnvContent, validateCliEnvImport } from "./parse-cli-env";

describe("parseCliEnvContent", () => {
  it("parses VITE_ keys from setup output", () => {
    const parsed = parseCliEnvContent(`
# comment
VITE_FLUXYCHAT_WORKER_URL=http://127.0.0.1:8787
VITE_FLUXYCHAT_MEMBER_JWT=eyJ.test
VITE_FLUXYCHAT_ROOM_ID=dev-local-general
VITE_FLUXYCHAT_PROJECT_ID=dev-local
`);
    expect(parsed.workerUrl).toBe("http://127.0.0.1:8787");
    expect(parsed.memberJwt).toBe("eyJ.test");
    expect(parsed.roomId).toBe("dev-local-general");
    expect(parsed.projectId).toBe("dev-local");
  });

  it("parses optional user id", () => {
    const parsed = parseCliEnvContent("VITE_FLUXYCHAT_USER_ID=demo-guest\n");
    expect(parsed.userId).toBe("demo-guest");
  });

  it("validates required fields", () => {
    expect(validateCliEnvImport({})).toMatch(/JWT/);
    expect(
      validateCliEnvImport({
        memberJwt: "x",
        roomId: "r",
        projectId: "p",
      }),
    ).toBeNull();
  });
});
