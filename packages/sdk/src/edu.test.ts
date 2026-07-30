import { describe, expect, it } from "vitest";
import {
  createVerticalWorkflow,
  DEMO_ADAPTERS,
  VERTICAL_DEMO_SEEDS,
  buildVerticalSessionReport,
  runVerticalDemoStep,
} from "./edu";

describe("@fluxy-chat/sdk/edu subpath", () => {
  it("exports edu workflow helpers", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu);
    runVerticalDemoStep(workflow, "edu", 0);
    expect(workflow.platform.events().length).toBeGreaterThan(0);
  });

  it("exports demo SFU adapter", async () => {
    const session = await DEMO_ADAPTERS.sfu.createSession({
      roomId: "room_test",
      participantId: "teacher",
      role: "host",
    });
    expect(session.provider).toBe("demo-sfu");
  });

  it("exports session report helper", () => {
    const workflow = createVerticalWorkflow(VERTICAL_DEMO_SEEDS.edu);
    for (let step = 0; step < 5; step += 1) runVerticalDemoStep(workflow, "edu", step);
    expect(buildVerticalSessionReport("edu", workflow).length).toBeGreaterThan(0);
  });
});
