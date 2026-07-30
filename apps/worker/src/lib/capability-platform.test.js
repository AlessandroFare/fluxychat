import { describe, expect, it } from "vitest";
import { evaluateCapabilityPolicy } from "./capability-platform.js";

describe("capability platform policy", () => {
  it("allows self-actor attendance heartbeats", () => {
    const result = evaluateCapabilityPolicy(
      { userId: "u1", roles: ["student"] },
      { id: "u1", type: "user", role: "student" },
      "attendance.heartbeat",
    );
    expect(result.ok).toBe(true);
  });

  it("denies grade approval without teacher role", () => {
    const result = evaluateCapabilityPolicy(
      { userId: "u1", roles: ["student"] },
      { id: "u1", type: "user", role: "student" },
      "edu.grade.approved",
    );
    expect(result.ok).toBe(false);
  });

  it("allows teachers to approve grades", () => {
    const result = evaluateCapabilityPolicy(
      { userId: "t1", roles: ["teacher"] },
      { id: "t1", type: "user", role: "teacher" },
      "edu.grade.approved",
    );
    expect(result.ok).toBe(true);
  });

  it("allows unknown event types by default", () => {
    const result = evaluateCapabilityPolicy(
      { userId: "u1", roles: [] },
      { id: "u1", type: "user" },
      "custom.experiment",
    );
    expect(result.ok).toBe(true);
  });
});
