import { describe, expect, it } from "vitest";
import {
  FEATURE_FLAG_KEYS,
  envFallbackBoolean,
  getClientFeatureFlags,
  getFeatureFlagBoolean,
  isFlagshipConfigured,
} from "./feature-flags.js";

describe("feature-flags", () => {
  it("falls back to env when FLAGS binding is absent", async () => {
    const env = {
      FEATURE_VOICE_MESSAGES: "false",
      EMBED_WIDGET_ENABLED: "true",
    };
    expect(isFlagshipConfigured(env)).toBe(false);
    expect(await getFeatureFlagBoolean(env, FEATURE_FLAG_KEYS.VOICE_MESSAGES)).toBe(
      false,
    );
    expect(await getFeatureFlagBoolean(env, FEATURE_FLAG_KEYS.EMBED_WIDGET)).toBe(
      true,
    );
  });

  it("uses env.FLAGS when bound", async () => {
    const env = {
      FLAGS: {
        getBooleanValue: async (key, defaultValue) => {
          if (key === "reply_suggestions") return false;
          return defaultValue;
        },
      },
    };
    expect(isFlagshipConfigured(env)).toBe(true);
    expect(await getFeatureFlagBoolean(env, FEATURE_FLAG_KEYS.REPLY_SUGGESTIONS)).toBe(
      false,
    );
  });

  it("passes evaluation context to Flagship", async () => {
    let captured = null;
    const env = {
      FLAGS: {
        getBooleanValue: async (key, defaultValue, context) => {
          captured = { key, defaultValue, context };
          return true;
        },
      },
    };
    await getFeatureFlagBoolean(env, FEATURE_FLAG_KEYS.REPLY_SUGGESTIONS, {
      context: { userId: "u1", projectId: "p1", roomId: "r1" },
    });
    expect(captured?.context).toEqual({
      userId: "u1",
      projectId: "p1",
      roomId: "r1",
    });
  });

  it("getClientFeatureFlags returns all known keys", async () => {
    const flags = await getClientFeatureFlags({});
    expect(flags.voice_messages).toBe(true);
    expect(flags.reply_suggestions).toBe(true);
    expect(flags.embed_widget).toBe(true);
    expect(flags.reconnect_backoff_fluxy).toBe(false);
  });

  it("envFallbackBoolean respects legacy env keys", () => {
    expect(
      envFallbackBoolean(FEATURE_FLAG_KEYS.VOICE_MESSAGES, {
        VOICE_MESSAGES_ENABLED: "false",
      }),
    ).toBe(false);
    expect(
      envFallbackBoolean(FEATURE_FLAG_KEYS.RECONNECT_BACKOFF_FLUXY, {
        FEATURE_RECONNECT_BACKOFF_FLUXY: "true",
      }),
    ).toBe(true);
  });
});
