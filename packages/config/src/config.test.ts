import { describe, expect, it } from "vitest";
import { defineConfig, allow, block, allowPublish, blockPublish, toHostedOverlay } from "./index.js";
import { resolveRoomConfig } from "./resolve-room.js";
import { runRoomAuthz, runPublishMiddleware } from "./runtime.js";

describe("resolveRoomConfig", () => {
  it("picks the most specific template", () => {
    const config = defineConfig({
      rooms: {
        "room-vip-*": { anonymous: false },
        "room-*": { anonymous: true },
      },
    });
    expect(resolveRoomConfig(config, "room-vip-1").anonymous).toBe(false);
    expect(resolveRoomConfig(config, "room-general").anonymous).toBe(true);
  });
});

describe("runRoomAuthz", () => {
  it("blocks anonymous when room disables it", async () => {
    const config = defineConfig({
      rooms: { "support-*": { anonymous: false } },
    });
    const result = await runRoomAuthz(config, {
      roomId: "support-1",
      userId: "anon_1",
      claims: {},
      anonymous: true,
    });
    expect(result.action).toBe("block");
  });

  it("runs custom authz callback", async () => {
    const config = defineConfig({
      rooms: {
        "room-*": {
          authz: (ctx) =>
            ctx.userId.startsWith("banned:")
              ? block("You are banned.")
              : allow({ publish: true }),
        },
      },
    });
    const ok = await runRoomAuthz(config, {
      roomId: "room-1",
      userId: "user_1",
      claims: {},
      anonymous: false,
    });
    expect(ok.action).toBe("allow");
  });
});

describe("runPublishMiddleware", () => {
  it("blocks and masks through the chain", async () => {
    const config = defineConfig({
      rooms: {
        "room-*": {
          onPublish: [
            (ctx) =>
              ctx.message.rawContent.includes("secret")
                ? blockPublish("No secrets.")
                : allowPublish(),
            (ctx) =>
              ctx.message.rawContent.includes("bad")
                ? { action: "mask", content: ctx.message.rawContent.replace("bad", "***") }
                : allowPublish(),
          ],
        },
      },
    });
    const blocked = await runPublishMiddleware(config, "room-1", {
      roomId: "room-1",
      userId: "u1",
      message: { content: "my secret", rawContent: "my secret" },
    });
    expect(blocked.ok).toBe(false);

    const masked = await runPublishMiddleware(config, "room-1", {
      roomId: "room-1",
      userId: "u1",
      message: { content: "bad word", rawContent: "bad word" },
    });
    expect(masked.ok).toBe(true);
    if (masked.ok) expect(masked.content).toBe("*** word");
  });
});

describe("toHostedOverlay", () => {
  it("drops callbacks and keeps declared room slots", () => {
    const overlay = toHostedOverlay(
      defineConfig({
        hostedPublish: { denySubstrings: ["secret"], guestCanPublish: false },
        rooms: {
          "support-*": {
            anonymous: false,
            guestCanPublish: false,
            extensions: [{ id: "state", kind: "kv" }],
            authz: () => block("nope"),
            onPublish: [() => allowPublish()],
          },
        },
      }),
    );
    expect(overlay.denySubstrings).toEqual(["secret"]);
    expect(overlay.guestCanPublish).toBe(false);
    expect(overlay.rooms?.["support-*"]?.anonymous).toBe(false);
    expect(overlay.rooms?.["support-*"]?.extensions).toEqual([{ id: "state", kind: "kv" }]);
    expect(overlay.rooms?.["support-*"]).not.toHaveProperty("authz");
  });
});
