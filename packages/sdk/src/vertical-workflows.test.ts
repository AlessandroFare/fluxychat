import { describe, expect, it } from "vitest";
import { createVerticalWorkflow, runVerticalDemoStep, VERTICAL_DEMO_SEEDS, buildVerticalSessionReport } from "./vertical-workflows";

describe("vertical workflows", () => {
  it("runs the edu demo without duplicate votes or tenant leaks", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu);
    for (let step = 0; step < 5; step += 1) runVerticalDemoStep(workflow, "edu", step);
    expect(workflow.state.attendance.size).toBeGreaterThan(0);
    expect(workflow.platform.events().length).toBeGreaterThan(5);
    expect(workflow.activityFeed(3)).toHaveLength(3);
  });

  it("requires human approval before publishing grades", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu);
    const grade = workflow.suggestGrade({
      studentId: "s1",
      rubricId: "r1",
      score: 88,
      feedback: "Good work",
      suggestedBy: "ai",
    });
    expect(grade.status).toBe("draft");
    expect(workflow.approveGrade(grade.id, "teacher")).not.toBeNull();
    expect(workflow.approveGrade(grade.id, "teacher")).toBeNull();
  });

  it("rejects duplicate Q&A upvotes", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.event);
    expect(workflow.upvoteQuestion("q1", "u1")).toBe(true);
    expect(workflow.upvoteQuestion("q1", "u1")).toBe(false);
  });

  it("builds an edu session report after the demo journey", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu);
    for (let step = 0; step < 5; step += 1) runVerticalDemoStep(workflow, "edu", step);
    const report = buildVerticalSessionReport("edu", workflow);
    expect(report.some((line) => line.label === "Grades approved" && line.value === "1")).toBe(true);
  });
});
