import { describe, it, expect } from "vitest";
import {
  getConsentStatusForUser,
  isEuRegion,
  projectRequiresConsentBanner,
  recordConsentEvent,
  upsertProjectConsentSettings,
} from "./consent-dpa.js";

function createEnv({ residencyRow = null, consentRow = null } = {}) {
  const consentSettings = consentRow ? { ...consentRow } : null;
  const residency = residencyRow ? { ...residencyRow } : null;
  const events = [];

  return {
    DATA_REGION: "eu-west",
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("FROM project_consent_settings")) {
                  return consentSettings;
                }
                if (sql.includes("FROM project_data_residency")) {
                  return residency;
                }
                if (sql.includes("FROM consent_events")) {
                  const projectId = args[0];
                  const userId = args[1];
                  const filtered = events.filter(
                    (e) => e.project_id === projectId && e.user_id === userId,
                  );
                  return filtered.sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
                }
                return null;
              },
              async all() {
                if (sql.includes("FROM consent_events") && sql.includes("ORDER BY")) {
                  return { results: [...events].reverse() };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO project_consent_settings")) {
                  Object.assign(consentSettings ?? {}, {
                    project_id: args[0],
                    enabled: args[1],
                    auto_eu_only: args[2],
                    dpa_version: args[3],
                    banner_title: args[4],
                    banner_body: args[5],
                    dpa_document_url: args[6],
                    require_room_consent: args[7],
                    updated_at: args[8],
                  });
                }
                if (sql.includes("INSERT INTO consent_events")) {
                  events.push({
                    id: args[0],
                    project_id: args[1],
                    user_id: args[2],
                    room_id: args[3],
                    event_type: args[4],
                    dpa_version: args[5],
                    created_at: args[9],
                  });
                }
                return { meta: { changes: 1 } };
              },
            };
          },
        };
      },
    },
    _events: events,
    _consentSettings: consentSettings,
  };
}

describe("consent-dpa", () => {
  it("detects EU regions", () => {
    expect(isEuRegion("eu-west")).toBe(true);
    expect(isEuRegion("us-east")).toBe(false);
  });

  it("requires banner when EU residency and consent enabled", async () => {
    const env = createEnv({
      consentRow: {
        enabled: 1,
        auto_eu_only: 1,
        dpa_version: "1.0",
        require_room_consent: 0,
      },
      residencyRow: {
        primary_region: "eu-west",
        allowed_regions_json: '["eu-west"]',
        inference_region: "eu-west",
        enforce_writes: 1,
      },
    });
    const policy = await projectRequiresConsentBanner(env, "p1");
    expect(policy.required).toBe(true);
  });

  it("getConsentStatusForUser shows banner until accepted", async () => {
    const env = createEnv({
      consentRow: {
        enabled: 1,
        auto_eu_only: 0,
        dpa_version: "2.0",
        banner_title: "Consent",
        banner_body: "Please accept",
        require_room_consent: 0,
      },
    });

    const before = await getConsentStatusForUser(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "lobby",
    });
    expect(before.needsBanner).toBe(true);

    await recordConsentEvent(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "lobby",
      eventType: "accepted",
      dpaVersion: "2.0",
    });

    const after = await getConsentStatusForUser(env, {
      projectId: "p1",
      userId: "u1",
      roomId: "lobby",
    });
    expect(after.needsBanner).toBe(false);
  });

  it("upsertProjectConsentSettings persists flags", async () => {
    const env = createEnv({ consentRow: {} });
    const result = await upsertProjectConsentSettings(env, "p1", {
      enabled: true,
      autoEuOnly: true,
      dpaVersion: "1.1",
      requireRoomConsent: true,
    });
    expect(result.ok).toBe(true);
    expect(result.settings.dpaVersion).toBe("1.1");
    expect(result.settings.requireRoomConsent).toBe(true);
  });
});
