import { describe, expect, it } from "vitest";
import { getPublicShareMetaByToken, getPublicShareMetaForRoom } from "./public-share-meta.js";

describe("public share tokens", () => {
  it("404s private rooms", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return {
                first: async () => ({ id: "r1", name: "secret", type: "group", project_id: "p1" }),
              };
            },
          };
        },
      },
    };
    const result = await getPublicShareMetaForRoom(env, "r1");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("not_public");
  });

  it("mints a hex token path, not the room id", async () => {
    const env = {
      PUBLIC_GUEST_ENABLED: "true",
      PUBLIC_GUEST_READ_ONLY: "true",
      DB: {
        prepare(sql) {
          return {
            bind() {
              return {
                first: async () => {
                  if (String(sql).includes("FROM rooms")) {
                    return { id: "lobby", name: "Lobby", type: "public", project_id: "p1" };
                  }
                  return null;
                },
                run: async () => ({ success: true }),
              };
            },
          };
        },
      },
    };
    const result = await getPublicShareMetaForRoom(env, "lobby");
    expect(result.ok).toBe(true);
    expect(result.shareToken).toMatch(/^[a-f0-9]{48}$/i);
    expect(result.path).toBe(`/share/${result.shareToken}`);
    expect(result.path).not.toContain("lobby");
    expect(JSON.stringify(result)).not.toMatch(/pk_|fc_/);
  });

  it("rejects short or room-shaped public tokens", async () => {
    const env = {
      DB: {
        prepare() {
          return { bind() { return { first: async () => null }; } };
        },
      },
    };
    const result = await getPublicShareMetaByToken(env, "lobby");
    expect(result.ok).toBe(false);
  });
});
