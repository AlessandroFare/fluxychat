import { describe, it, expect } from "vitest";
import { createExpertRouter } from "./expert-router";

describe("createExpertRouter", () => {
  it("registers and retrieves an agent", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing", "support"],
      skillLevels: { billing: "expert", support: "intermediate" },
      maxConcurrentChats: 5,
      activeChats: 0,
      isAvailable: true,
      languages: ["en"],
    });
    const agent = er.getAgent("agent-1");
    expect(agent).toBeDefined();
    expect(agent!.name).toBe("Alice");
  });

  it("updateAgent modifies agent fields", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing"],
      skillLevels: { billing: "expert" },
      maxConcurrentChats: 5,
      activeChats: 0,
      isAvailable: true,
      languages: ["en"],
    });
    er.updateAgent("agent-1", { isAvailable: false });
    expect(er.getAgent("agent-1")!.isAvailable).toBe(false);
  });

  it("unregisterAgent removes agent", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing"],
      skillLevels: { billing: "expert" },
      maxConcurrentChats: 5,
      activeChats: 0,
      isAvailable: true,
      languages: ["en"],
    });
    expect(er.unregisterAgent("agent-1")).toBe(true);
    expect(er.getAgent("agent-1")).toBeUndefined();
  });

  it("findBestAgent returns agent with required skills", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing", "support"],
      skillLevels: { billing: "expert", support: "intermediate" },
      maxConcurrentChats: 5,
      activeChats: 1,
      isAvailable: true,
      languages: ["en"],
    });
    const result = er.findBestAgent({
      userId: "user-1",
      requiredSkills: ["billing"],
      priority: "normal",
    });
    expect(result).toBeDefined();
    expect(result!.agentId).toBe("agent-1");
    expect(result!.score).toBeGreaterThan(0);
  });

  it("findBestAgent returns undefined when no agent available", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing"],
      skillLevels: { billing: "expert" },
      maxConcurrentChats: 1,
      activeChats: 1,
      isAvailable: true,
      languages: ["en"],
    });
    const result = er.findBestAgent({
      userId: "user-1",
      requiredSkills: ["billing"],
      priority: "normal",
    });
    expect(result).toBeUndefined();
  });

  it("setSlaPolicies configures policies", () => {
    const er = createExpertRouter();
    er.setSlaPolicies([{ priority: "urgent", targetSeconds: 60, escalationAction: "escalate" }]);
    const result = er.findBestAgent({
      userId: "user-1",
      priority: "urgent",
    });
    expect(result).toBeUndefined();
  });

  it("getSlaStatus returns status for all agents", () => {
    const er = createExpertRouter();
    er.registerAgent({
      id: "agent-1",
      name: "Alice",
      skills: ["billing"],
      skillLevels: { billing: "expert" },
      maxConcurrentChats: 5,
      activeChats: 2,
      isAvailable: true,
      languages: ["en"],
    });
    const status = er.getSlaStatus();
    expect(status).toHaveLength(1);
    expect(status[0].agentId).toBe("agent-1");
  });
});
