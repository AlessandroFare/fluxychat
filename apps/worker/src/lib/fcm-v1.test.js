import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseServiceAccountJson } from "./fcm-v1.js";

describe("fcm-v1", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parseServiceAccountJson accepts valid JSON", () => {
    const sa = parseServiceAccountJson(
      JSON.stringify({
        client_email: "firebase@project.iam.gserviceaccount.com",
        private_key: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n",
        project_id: "my-project",
      }),
    );
    expect(sa?.project_id).toBe("my-project");
    expect(sa?.client_email).toContain("firebase@");
  });

  it("parseServiceAccountJson rejects invalid JSON", () => {
    expect(parseServiceAccountJson("not-json")).toBeNull();
    expect(parseServiceAccountJson("{}")).toBeNull();
  });
});
