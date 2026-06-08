import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  extractSmsTargetFromPreferences,
  isOfflineSmsEnabled,
  isUserIdleInRoom,
  maybeNotifyOfflineSms,
} from "./offline-notify-sent.js";

describe("offline-notify-sent", () => {
  it("isOfflineSmsEnabled requires flag and keys", () => {
    expect(isOfflineSmsEnabled({})).toBe(false);
    expect(
      isOfflineSmsEnabled({
        OFFLINE_SMS_ENABLED: "true",
        SENT_DM_API_KEY: "k",
        SENT_DM_PROFILE_ID: "p",
      }),
    ).toBe(true);
  });

  it("extractSmsTargetFromPreferences validates e164 and opt-in", () => {
    expect(
      extractSmsTargetFromPreferences({
        smsE164: "+14155551234",
        smsOptIn: true,
      }),
    ).toEqual({ e164: "+14155551234", optIn: true });
    expect(
      extractSmsTargetFromPreferences({
        smsE164: "not-a-phone",
        smsOptIn: true,
      }),
    ).toBeNull();
    expect(
      extractSmsTargetFromPreferences({
        smsE164: "+14155551234",
        smsOptIn: false,
      }),
    ).toBeNull();
  });

  it("isUserIdleInRoom treats missing receipt as idle", async () => {
    const env = {
      DB: {
        prepare() {
          return {
            bind() {
              return { first: async () => null };
            },
          };
        },
      },
    };
    expect(
      await isUserIdleInRoom(env, {
        projectId: "p",
        roomId: "r",
        userId: "u",
        idleMinutes: 5,
      }),
    ).toBe(true);
  });

  describe("maybeNotifyOfflineSms", () => {
    beforeEach(() => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response("{}", { status: 200 })),
      );
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("sends when mention recipient is idle and opted in", async () => {
      const env = {
        OFFLINE_SMS_ENABLED: "true",
        SENT_DM_API_KEY: "secret",
        SENT_DM_PROFILE_ID: "profile-1",
        OFFLINE_SMS_IDLE_MINUTES: "5",
        RATE_LIMIT_FALLBACK_ALLOW: "true",
        DB: {
          prepare(sql) {
            return {
              bind() {
                return {
                  first: async () => {
                    if (sql.includes("FROM rooms")) return { type: "channel" };
                    if (sql.includes("room_members") && sql.includes("preferences")) {
                      return {
                        notify_enabled: 1,
                        preferences_json: JSON.stringify({
                          smsE164: "+14155559999",
                          smsOptIn: true,
                        }),
                      };
                    }
                    if (sql.includes("read_receipts")) return null;
                    return null;
                  },
                  all: async () => ({ results: [] }),
                };
              },
            };
          },
        },
      };

      await maybeNotifyOfflineSms(env, {
        projectId: "proj",
        roomId: "room",
        authorUserId: "alice",
        messageId: 42,
        content: "hello @bob",
        mentionedUserIds: ["bob"],
        roomType: "channel",
      });

      expect(fetch).toHaveBeenCalledTimes(1);
      const [url, init] = fetch.mock.calls[0];
      expect(String(url)).toContain("api.sent.dm");
      expect(init.method).toBe("POST");
    });

    it("includes media_url template params when message has an image attachment", async () => {
      const env = {
        OFFLINE_SMS_ENABLED: "true",
        SENT_DM_API_KEY: "secret",
        SENT_DM_PROFILE_ID: "profile-1",
        PUBLIC_APP_URL: "https://app.fluxy.chat",
        OFFLINE_SMS_IDLE_MINUTES: "5",
        RATE_LIMIT_FALLBACK_ALLOW: "true",
        DB: {
          prepare(sql) {
            return {
              bind() {
                return {
                  first: async () => {
                    if (sql.includes("FROM rooms")) return { type: "channel" };
                    if (sql.includes("room_members") && sql.includes("preferences")) {
                      return {
                        notify_enabled: 1,
                        preferences_json: JSON.stringify({
                          smsE164: "+14155559999",
                          smsOptIn: true,
                        }),
                      };
                    }
                    if (sql.includes("read_receipts")) return null;
                    return null;
                  },
                  all: async () => ({ results: [] }),
                };
              },
            };
          },
        },
      };

      await maybeNotifyOfflineSms(env, {
        projectId: "proj",
        roomId: "room",
        authorUserId: "alice",
        messageId: 99,
        content: "",
        mentionedUserIds: ["bob"],
        roomType: "channel",
        attachments: [
          {
            kind: "image",
            url: "https://cdn.example/shot.png",
            name: "shot.png",
            contentType: "image/png",
          },
        ],
      });

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.template.parameters.preview).toBe("Photo");
      expect(body.template.parameters.media_url).toBe("https://cdn.example/shot.png");
      expect(body.template.parameters.has_media).toBe("true");
    });
  });
});
