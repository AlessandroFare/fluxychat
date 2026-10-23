import { describe, expect, it } from "vitest";
import {
  getPublicShareMetaByToken,
  getPublicShareMetaForRoom,
  revokeRoomShareLink,
} from "./public-share-meta.js";

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

  it("rotates the link on revoke: the old token dies, a fresh one is returned", async () => {
    let activeToken = "a".repeat(48);
    const revokedAt = [];
    const inserted = [];
    const env = {
      DB: {
        prepare(sql) {
          const s = String(sql);
          return {
            bind(...args) {
              return {
                first: async () => {
                  if (s.includes("FROM rooms")) {
                    return { id: "lobby", name: "Lobby", type: "public", project_id: "p1" };
                  }
                  if (s.includes("FROM room_share_links")) {
                    return activeToken ? { token: activeToken } : null;
                  }
                  return null;
                },
                run: async () => {
                  if (s.startsWith("UPDATE room_share_links")) {
                    revokedAt.push(args[0]);
                    activeToken = null;
                  } else if (s.startsWith("INSERT INTO room_share_links")) {
                    inserted.push(args[0]);
                    activeToken = args[0];
                  }
                  return { success: true };
                },
              };
            },
          };
        },
      },
    };
    const result = await revokeRoomShareLink(env, "lobby");
    expect(result.ok).toBe(true);
    expect(result.token).toMatch(/^[a-f0-9]{48}$/i);
    expect(result.token).not.toBe("a".repeat(48));
    expect(revokedAt.length).toBe(1);
    expect(inserted).toEqual([result.token]);
  });
});
