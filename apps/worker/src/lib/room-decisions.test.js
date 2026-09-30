import { describe, expect, it } from "vitest";
import {
  applyFloorControl,
  choiceMargin,
  heuristicRouteTurn,
  notifyTriageChoice,
  noulToNlChoice,
  resolveDecisionsConfig,
} from "./room-decisions.js";

describe("room-decisions", () => {
  it("computes probability margin", () => {
    expect(choiceMargin({ a: 0.7, b: 0.2, c: 0.1 })).toBeCloseTo(0.5);
    expect(choiceMargin({})).toBeNull();
  });

  it("defaults floor to keyword (legacy ambient)", () => {
    expect(resolveDecisionsConfig({}, {}).floorMode).toBe("keyword");
    expect(
      resolveDecisionsConfig({}, { decisions: { shouldRespond: { mode: "silent" } } }).floorMode,
    ).toBe("silent");
  });

  it("invoke_only silences ambient without @mention", async () => {
    const inserts = [];
    const env = {
      ROOM_FLOOR_MODE: "invoke_only",
      DB: {
        prepare: () => ({
          bind: (...args) => ({
            run: async () => {
              inserts.push(args);
              return { meta: { changes: 1 } };
            },
          }),
        }),
      },
    };
    const silent = await applyFloorControl(env, {
      projectId: "p1",
      roomId: "r1",
      content: "hello everyone",
    });
    expect(silent.allowAmbient).toBe(false);
    const speak = await applyFloorControl(env, {
      projectId: "p1",
      roomId: "r1",
      content: "hey @ops look",
    });
    expect(speak.allowAmbient).toBe(true);
    expect(inserts.length).toBeGreaterThan(0);
  });

  it("silent floor never dispatches ambient", async () => {
    const env = {
      ROOM_FLOOR_MODE: "silent",
      DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { changes: 1 } }) }) }) },
    };
    const out = await applyFloorControl(env, { projectId: "p", roomId: "r", content: "@bot hi" });
    expect(out.allowAmbient).toBe(false);
    expect(out.choice).toBe("silence");
  });

  it("routes ack-only turns to skip and questions to large", () => {
    expect(heuristicRouteTurn("thanks")).toBe("skip");
    expect(heuristicRouteTurn("What is the SLA?")).toBe("large");
    expect(heuristicRouteTurn("hello there")).toBe("small");
    expect(resolveDecisionsConfig({}, {}).routeMode).toBe("shadow");
  });

  it("triages mentions high and short acks low", () => {
    expect(notifyTriageChoice({ isMention: true, preview: "hey" })).toBe("high");
    expect(notifyTriageChoice({ isMention: false, preview: "ok thanks" })).toBe("low");
  });

  it("maps policy noul to ok/warn/block", () => {
    expect(noulToNlChoice(0.2)).toBe("ok");
    expect(noulToNlChoice(0.5)).toBe("warn");
    expect(noulToNlChoice(0.9)).toBe("block");
  });

  it("leaves agent text unchanged when policy is empty", async () => {
    const { applyNlPolicyToAgentReply } = await import("./room-decisions.js");
    const out = await applyNlPolicyToAgentReply({}, { text: "hello", policyText: "" });
    expect(out.text).toBe("hello");
    expect(out.choice).toBe("ok");
  });
});
