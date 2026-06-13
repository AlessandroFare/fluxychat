import { describe, expect, it } from "vitest";
import {
  canManageProfiles,
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  buildProfilePrompt,
  assignProfileToRoom,
  getRoomAssignment,
  getProfileForRoom,
  removeRoomAssignment,
  abTestAssign,
  getAbTestResults,
} from "./agent-profiles.js";

function createProfileEnv() {
  const profiles = [];
  const assignments = [];

  return {
    profiles, assignments,
    DB: {
      prepare(sql) {
        return {
          bind(...args) {
            return {
              async first() {
                if (sql.includes("SELECT id FROM agent_profiles WHERE project_id = ? AND name = ?")) {
                  return profiles.find((p) => p.project_id === args[0] && p.name === args[1]) || null;
                }
                if (sql.includes("AND enabled = 1")) {
                  return profiles.find((p) => p.id === args[0] && p.project_id === args[1] && p.enabled === 1) || null;
                }
                if (sql.includes("SELECT id FROM agent_profiles WHERE id = ? AND project_id = ?")) {
                  return profiles.find((p) => p.id === args[0] && p.project_id === args[1]) || null;
                }
                if (sql.includes("SELECT id FROM agent_profiles WHERE project_id = ? AND name = ? AND id != ?")) {
                  return profiles.find((p) => p.project_id === args[0] && p.name === args[1] && p.id !== args[2]) || null;
                }
                if (sql.includes("SELECT * FROM agent_profiles WHERE id = ? AND project_id = ?")) {
                  return profiles.find((p) => p.id === args[0] && p.project_id === args[1]) || null;
                }
                if (sql.includes("SELECT * FROM room_profile_assignments WHERE project_id = ? AND room_id = ?")) {
                  return assignments.find((a) => a.project_id === args[0] && a.room_id === args[1]) || null;
                }
                if (sql.includes("SELECT COUNT(*) AS cnt FROM room_profile_assignments WHERE profile_id = ?")) {
                  if (sql.includes("assigned_by = 'ab_test'")) {
                    return { cnt: assignments.filter((a) => a.profile_id === args[0] && a.assigned_by === "ab_test").length };
                  }
                  return { cnt: assignments.filter((a) => a.profile_id === args[0]).length };
                }
                return null;
              },
              async all() {
                if (sql.includes("SELECT * FROM agent_profiles WHERE project_id = ?")) {
                  return { results: profiles.filter((p) => p.project_id === args[0]) };
                }
                return { results: [] };
              },
              async run() {
                if (sql.includes("INSERT INTO agent_profiles")) {
                  profiles.push({
                    id: args[0], project_id: args[1], name: args[2], description: args[3],
                    tone: args[4], verbosity: args[5], follow_up_style: args[6],
                    escalation_threshold: args[7], policy_constraints: args[8],
                    business_objectives: args[9], system_prompt_addendum: args[10],
                    ab_test_weight: args[11], enabled: 1,
                    created_at: args[12], updated_at: args[13],
                  });
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("UPDATE agent_profiles SET")) {
                  const p = profiles.find((x) => x.id === args[args.length - 2] && x.project_id === args[args.length - 1]);
                  if (p) {
                    for (let i = 0; i < sql.split("?").length - 1; i++) {
                      const part = sql.split("?")[i];
                      if (part.includes("name =")) p.name = args[i];
                      else if (part.includes("description =")) p.description = args[i];
                      else if (part.includes("tone =")) p.tone = args[i];
                      else if (part.includes("verbosity =")) p.verbosity = args[i];
                      else if (part.includes("follow_up_style =")) p.follow_up_style = args[i];
                      else if (part.includes("escalation_threshold =")) p.escalation_threshold = args[i];
                      else if (part.includes("policy_constraints =")) p.policy_constraints = args[i];
                      else if (part.includes("business_objectives =")) p.business_objectives = args[i];
                      else if (part.includes("system_prompt_addendum =")) p.system_prompt_addendum = args[i];
                      else if (part.includes("ab_test_weight =")) p.ab_test_weight = args[i];
                      else if (part.includes("enabled =")) p.enabled = args[i];
                    }
                    p.updated_at = args[args.length - 3] || p.updated_at;
                  }
                  return { meta: { changes: p ? 1 : 0 } };
                }
                if (sql.includes("DELETE FROM room_profile_assignments WHERE profile_id")) {
                  const before = assignments.length;
                  for (let i = assignments.length - 1; i >= 0; i--) {
                    if (assignments[i].profile_id === args[0] && assignments[i].project_id === args[1]) {
                      assignments.splice(i, 1);
                    }
                  }
                  return { meta: { changes: before - assignments.length } };
                }
                if (sql.includes("DELETE FROM agent_profiles")) {
                  const before = profiles.length;
                  for (let i = profiles.length - 1; i >= 0; i--) {
                    if (profiles[i].id === args[0] && profiles[i].project_id === args[1]) {
                      profiles.splice(i, 1);
                    }
                  }
                  return { meta: { changes: before - profiles.length } };
                }
                if (sql.includes("INSERT INTO room_profile_assignments")) {
                  const existing = assignments.findIndex((a) => a.project_id === args[1] && a.room_id === args[2]);
                  const entry = {
                    id: args[0], project_id: args[1], room_id: args[2], profile_id: args[3],
                    assigned_by: args[4], ab_test_group: args[5],
                    created_at: args[6], updated_at: args[7],
                  };
                  if (existing >= 0) { assignments[existing] = entry; } else { assignments.push(entry); }
                  return { meta: { changes: 1 } };
                }
                if (sql.includes("DELETE FROM room_profile_assignments WHERE project_id")) {
                  const before = assignments.length;
                  for (let i = assignments.length - 1; i >= 0; i--) {
                    if (assignments[i].project_id === args[0] && assignments[i].room_id === args[1]) {
                      assignments.splice(i, 1);
                    }
                  }
                  return { meta: { changes: before - assignments.length } };
                }
                return { meta: { changes: 0 } };
              }
            };
          }
        };
      }
    }
  };
}

describe("canManageProfiles", () => {
  it("allows owner", () => { expect(canManageProfiles(["owner"])).toBe(true); });
  it("allows admin", () => { expect(canManageProfiles(["admin"])).toBe(true); });
  it("rejects moderator", () => { expect(canManageProfiles(["moderator"])).toBe(false); });
  it("rejects undefined", () => { expect(canManageProfiles(undefined)).toBe(false); });
});

describe("createProfile", () => {
  it("creates a profile with defaults", async () => {
    const env = createProfileEnv();
    const result = await createProfile(env.DB, { projectId: "p1", name: "Support Bot" });
    expect(result.ok).toBe(true);
    expect(result.id).toBeTruthy();
    expect(env.profiles).toHaveLength(1);
    expect(env.profiles[0].tone).toBe("professional");
    expect(env.profiles[0].verbosity).toBe("balanced");
    expect(env.profiles[0].enabled).toBe(1);
  });

  it("creates with custom settings", async () => {
    const env = createProfileEnv();
    const result = await createProfile(env.DB, {
      projectId: "p1", name: "Sales Bot", tone: "friendly", verbosity: "concise",
      followUpStyle: "reactive", escalationThreshold: "low",
      policyConstraints: { max_response_length: 200 },
      businessObjectives: { priority: "upsell" },
      systemPromptAddendum: "Always mention discounts.",
      abTestWeight: 50,
    });
    expect(result.ok).toBe(true);
    expect(env.profiles[0].tone).toBe("friendly");
    expect(env.profiles[0].ab_test_weight).toBe(50);
    expect(env.profiles[0].system_prompt_addendum).toBe("Always mention discounts.");
  });

  it("rejects duplicate name", async () => {
    const env = createProfileEnv();
    await createProfile(env.DB, { projectId: "p1", name: "Support" });
    const result = await createProfile(env.DB, { projectId: "p1", name: "Support" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("name_taken");
  });

  it("rejects empty name", async () => {
    const env = createProfileEnv();
    const result = await createProfile(env.DB, { projectId: "p1", name: "" });
    expect(result.ok).toBe(false);
  });
});

describe("listProfiles", () => {
  it("lists all profiles", async () => {
    const env = createProfileEnv();
    await createProfile(env.DB, { projectId: "p1", name: "A" });
    await createProfile(env.DB, { projectId: "p1", name: "B" });
    const result = await listProfiles(env.DB, { projectId: "p1" });
    expect(result).toHaveLength(2);
  });

  it("only lists project profiles", async () => {
    const env = createProfileEnv();
    await createProfile(env.DB, { projectId: "p1", name: "A" });
    await createProfile(env.DB, { projectId: "p2", name: "B" });
    const result = await listProfiles(env.DB, { projectId: "p1" });
    expect(result).toHaveLength(1);
  });
});

describe("getProfile", () => {
  it("returns profile", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    const result = await getProfile(env.DB, { projectId: "p1", profileId: id });
    expect(result).toBeTruthy();
    expect(result.name).toBe("Test");
  });

  it("returns null for missing", async () => {
    const env = createProfileEnv();
    const result = await getProfile(env.DB, { projectId: "p1", profileId: "nonexistent" });
    expect(result).toBeNull();
  });
});

describe("updateProfile", () => {
  it("updates fields", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    const result = await updateProfile(env.DB, { projectId: "p1", profileId: id, tone: "casual", verbosity: "detailed" });
    expect(result.ok).toBe(true);
    expect(env.profiles[0].tone).toBe("casual");
    expect(env.profiles[0].verbosity).toBe("detailed");
  });

  it("rejects duplicate name", async () => {
    const env = createProfileEnv();
    await createProfile(env.DB, { projectId: "p1", name: "A" });
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "B" });
    const result = await updateProfile(env.DB, { projectId: "p1", profileId: id, name: "A" });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("name_taken");
  });

  it("returns not_found for missing", async () => {
    const env = createProfileEnv();
    const result = await updateProfile(env.DB, { projectId: "p1", profileId: "x", tone: "casual" });
    expect(result.ok).toBe(false);
  });
});

describe("deleteProfile", () => {
  it("deletes profile and its assignments", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    env.assignments.push({ profile_id: id, project_id: "p1", room_id: "r1" });
    const result = await deleteProfile(env.DB, { projectId: "p1", profileId: id });
    expect(result.deleted).toBe(true);
    expect(env.profiles).toHaveLength(0);
    expect(env.assignments).toHaveLength(0);
  });
});

describe("buildProfilePrompt", () => {
  it("builds prompt from profile", () => {
    const prompt = buildProfilePrompt({
      tone: "friendly", verbosity: "concise", followUpStyle: "reactive",
      escalationThreshold: "low",
      policyConstraints: { max_response_length: 200, blocked_topics: ["politics"] },
      businessObjectives: { priority: "satisfaction" },
      systemPromptAddendum: "Be extra nice.",
    });
    expect(prompt).toContain("friendly");
    expect(prompt).toContain("concise");
    expect(prompt).toContain("reactive");
    expect(prompt).toContain("Escalate to human when: low");
    expect(prompt).toContain("under 200 characters");
    expect(prompt).toContain("Avoid discussing: politics");
    expect(prompt).toContain("Business priority: satisfaction");
    expect(prompt).toContain("Be extra nice.");
  });

  it("returns null for null profile", () => {
    expect(buildProfilePrompt(null)).toBeNull();
  });

  it("handles never escalation", () => {
    const prompt = buildProfilePrompt({ tone: "professional", verbosity: "balanced", followUpStyle: "proactive", escalationThreshold: "never" });
    expect(prompt).toContain("Do not escalate");
  });
});

describe("assignProfileToRoom", () => {
  it("assigns profile to room", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    const result = await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id });
    expect(result.ok).toBe(true);
    expect(env.assignments).toHaveLength(1);
    expect(env.assignments[0].profile_id).toBe(id);
  });

  it("upserts on re-assignment", async () => {
    const env = createProfileEnv();
    const { id: id1 } = await createProfile(env.DB, { projectId: "p1", name: "A" });
    const { id: id2 } = await createProfile(env.DB, { projectId: "p1", name: "B" });
    await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id1 });
    await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id2 });
    expect(env.assignments).toHaveLength(1);
    expect(env.assignments[0].profile_id).toBe(id2);
  });

  it("rejects disabled profile", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    env.profiles[0].enabled = 0;
    const result = await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id });
    expect(result.ok).toBe(false);
  });
});

describe("getRoomAssignment / getProfileForRoom", () => {
  it("returns assignment", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id });
    const assignment = await getRoomAssignment(env.DB, { projectId: "p1", roomId: "r1" });
    expect(assignment).toBeTruthy();
    expect(assignment.profileId).toBe(id);
  });

  it("returns null when unassigned", async () => {
    const env = createProfileEnv();
    const result = await getRoomAssignment(env.DB, { projectId: "p1", roomId: "r1" });
    expect(result).toBeNull();
  });
});

describe("removeRoomAssignment", () => {
  it("removes assignment", async () => {
    const env = createProfileEnv();
    const { id } = await createProfile(env.DB, { projectId: "p1", name: "Test" });
    await assignProfileToRoom(env.DB, { projectId: "p1", roomId: "r1", profileId: id });
    const result = await removeRoomAssignment(env.DB, { projectId: "p1", roomId: "r1" });
    expect(result.removed).toBe(true);
    expect(env.assignments).toHaveLength(0);
  });
});

describe("abTestAssign", () => {
  it("assigns based on weights", async () => {
    const env = createProfileEnv();
    const { id: id1 } = await createProfile(env.DB, { projectId: "p1", name: "A", abTestWeight: 100 });
    const { id: id2 } = await createProfile(env.DB, { projectId: "p1", name: "B", abTestWeight: 0 });
    const result = await abTestAssign(env.DB, { projectId: "p1", roomId: "r1", profileIds: [id1, id2] });
    expect(result.ok).toBe(true);
    expect(result.profileId).toBe(id1);
    expect(result.group).toBe("A");
  });

  it("rejects empty profileIds", async () => {
    const env = createProfileEnv();
    const result = await abTestAssign(env.DB, { projectId: "p1", roomId: "r1", profileIds: [] });
    expect(result.ok).toBe(false);
  });

  it("rejects when no valid profiles", async () => {
    const env = createProfileEnv();
    const result = await abTestAssign(env.DB, { projectId: "p1", roomId: "r1", profileIds: ["nonexistent"] });
    expect(result.ok).toBe(false);
  });
});

describe("getAbTestResults", () => {
  it("returns results for profiles", async () => {
    const env = createProfileEnv();
    const { id: id1 } = await createProfile(env.DB, { projectId: "p1", name: "A", abTestWeight: 60 });
    const { id: id2 } = await createProfile(env.DB, { projectId: "p1", name: "B", abTestWeight: 40 });
    env.assignments.push({ profile_id: id1, project_id: "p1", room_id: "r1", assigned_by: "ab_test" });
    env.assignments.push({ profile_id: id1, project_id: "p1", room_id: "r2", assigned_by: "manual" });
    env.assignments.push({ profile_id: id2, project_id: "p1", room_id: "r3", assigned_by: "ab_test" });
    const result = await getAbTestResults(env.DB, { projectId: "p1", profileIds: [id1, id2] });
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.results[0].totalAssignments).toBe(2);
    expect(result.results[0].abTestAssignments).toBe(1);
    expect(result.results[1].abTestAssignments).toBe(1);
  });
});
