import { describe, it, expect, vi } from "vitest";
import {
  applySystemOneToolPass,
  buildClmRoomState,
  clmChoice,
  clmHitlNoulMin,
  clmNoul,
  clmNoulRequiresHuman,
  clmSystemOne,
  clmSystemOneUrl,
  collectOpenAiToolNames,
  filterAgentRowsByHandle,
  isClmConfigured,
  isSystemOneConfigured,
  JEV_MODEL_ID,
  parseClmAnswer,
  reorderOpenAiTools,
  resolveSystemOneProvider,
  shouldSystemOneEscalate,
  systemOne,
  truncateClmState,
  unwrapSystemOnePayload,
  wrapClmApprovalGate,
} from "./clm-system-one.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

describe("clm-system-one", () => {
  it("is unconfigured without CLM_BASE_URL", () => {
    expect(isClmConfigured({})).toBe(false);
    expect(isClmConfigured({ CLM_BASE_URL: "  " })).toBe(false);
    expect(isClmConfigured({ CLM_BASE_URL: "https://clm.example" })).toBe(true);
  });

  it("joins /v1/systemone without a double slash", () => {
    expect(clmSystemOneUrl({ CLM_BASE_URL: "https://clm.example/" })).toBe(
      "https://clm.example/v1/systemone",
    );
  });

  it("truncates state from the tail", () => {
    expect(truncateClmState("abc", 2)).toBe("bc");
    expect(truncateClmState("short", 80)).toBe("short");
  });

  it("requires a human when noul is missing or below the threshold", () => {
    expect(clmNoulRequiresHuman(undefined, 0.85)).toBe(true);
    expect(clmNoulRequiresHuman(0.4, 0.85)).toBe(true);
    expect(clmNoulRequiresHuman(0.9, 0.85)).toBe(false);
    expect(clmHitlNoulMin({ CLM_HITL_NOUL_MIN: "0.7" })).toBe(0.7);
    expect(clmHitlNoulMin({})).toBe(0.85);
  });

  it("parses TypeSafe-shaped answers", () => {
    expect(
      parseClmAnswer({ answers: { handle: { type: "choice", choice: "ops" } } }, "handle"),
    ).toEqual({ type: "choice", choice: "ops" });
    expect(parseClmAnswer({ answers: {} }, "handle")).toBeNull();
  });

  it("returns unconfigured without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await clmSystemOne({}, { state: "hi", questions: {}, fetchImpl });
    expect(result).toEqual({ ok: false, reason: "unconfigured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("maps SSRF failures to fail-closed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ssrf_blocked");
    });
    const result = await clmSystemOne(
      { CLM_BASE_URL: "http://127.0.0.1:8700" },
      {
        state: "room",
        questions: { handle: { type: "choice", instructions: "pick", criteria: { a: "a" } } },
        fetchImpl,
      },
    );
    expect(result).toEqual({ ok: false, reason: "ssrf_blocked" });
  });

  it("reads choice from system_one answers and rejects unknown keys", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: "clm-latest",
        answers: {
          handle: {
            type: "choice",
            choice: "ops",
            probabilities: { ops: 0.8, legal: 0.2 },
          },
        },
      }),
    );
    const ok = await clmChoice(
      { CLM_BASE_URL: "https://clm.example" },
      {
        state: "@ops close the deal",
        questionId: "handle",
        instructions: "Which agent should answer?",
        criteria: { ops: "ops", legal: "legal" },
        fetchImpl,
      },
    );
    expect(ok.ok).toBe(true);
    expect(ok.choice).toBe("ops");

    const bad = await clmChoice(
      { CLM_BASE_URL: "https://clm.example" },
      {
        state: "x",
        questionId: "handle",
        instructions: "pick",
        criteria: { ops: "ops" },
        fetchImpl: async () => jsonResponse({ answers: { handle: { type: "choice", choice: "ghost" } } }),
      },
    );
    expect(bad.ok).toBe(false);
    expect(bad.choice).toBeNull();
  });

  it("reads noul from answers", async () => {
    const result = await clmNoul(
      { CLM_BASE_URL: "https://clm.example" },
      {
        state: "delete production",
        questionId: "hitl",
        instructions: "This tool can run without a human reviewer.",
        fetchImpl: async () => jsonResponse({ answers: { hitl: { type: "noul", noul: 0.12 } } }),
      },
    );
    expect(result).toMatchObject({ ok: true, noul: 0.12 });
  });

  it("reorders tools without dropping names", () => {
    const tools = [
      { type: "function", function: { name: "search" } },
      { type: "function", function: { name: "web_fetch" } },
    ];
    expect(collectOpenAiToolNames(tools)).toEqual(["search", "web_fetch"]);
    expect(reorderOpenAiTools(tools, "web_fetch")[0].function.name).toBe("web_fetch");
    expect(collectOpenAiToolNames(reorderOpenAiTools(tools, "web_fetch"))).toEqual([
      "web_fetch",
      "search",
    ]);
    expect(reorderOpenAiTools(tools, "missing")).toBe(tools);
  });

  it("keeps all agent rows when the preferred handle is missing", () => {
    const rows = [
      { handle: "@ops", id: "1" },
      { handle: "legal", id: "2" },
    ];
    expect(filterAgentRowsByHandle(rows, "legal")).toEqual([{ handle: "legal", id: "2" }]);
    expect(filterAgentRowsByHandle(rows, "ghost")).toEqual(rows);
  });

  it("builds a truncated room state from history", () => {
    const state = buildClmRoomState("ping", [{ user_id: "u1", content: "hello" }]);
    expect(state).toContain("u1: hello");
    expect(state).toContain("user: ping");
  });

  it("wraps HITL: extra approval only when CLM returns a low noul", async () => {
    const inner = { needsApproval: async () => false };
    const env = { CLM_BASE_URL: "https://clm.example", CLM_HITL_NOUL_MIN: "0.85" };

    const low = wrapClmApprovalGate(inner, env, {
      fetchImpl: async () => jsonResponse({ answers: { hitl: { type: "noul", noul: 0.2 } } }),
    });
    expect(await low.needsApproval("web_fetch", {}, {})).toBe(true);

    const high = wrapClmApprovalGate(inner, env, {
      fetchImpl: async () => jsonResponse({ answers: { hitl: { type: "noul", noul: 0.99 } } }),
    });
    expect(await high.needsApproval("web_fetch", {}, {})).toBe(false);

    const down = wrapClmApprovalGate(inner, env, {
      fetchImpl: async () => {
        throw new Error("ssrf_blocked");
      },
    });
    expect(await down.needsApproval("web_fetch", {}, {})).toBe(false);

    const already = wrapClmApprovalGate({ needsApproval: async () => true }, env, {
      fetchImpl: vi.fn(),
    });
    expect(await already.needsApproval("web_fetch", {}, {})).toBe(true);
  });
});

describe("system one jev", () => {
  it("defaults to jev when Workers AI is bound, off when asked, clm when only GPU URL", () => {
    const ai = { run: async () => ({}) };
    expect(resolveSystemOneProvider({ AI: ai })).toBe("jev");
    expect(isSystemOneConfigured({ AI: ai })).toBe(true);
    expect(resolveSystemOneProvider({ AI: ai, SYSTEM_ONE_PROVIDER: "off" })).toBe("off");
    expect(resolveSystemOneProvider({ CLM_BASE_URL: "https://clm.example" })).toBe("clm");
    expect(resolveSystemOneProvider({ AI: ai, SYSTEM_ONE_PROVIDER: "clm" })).toBe("off");
    expect(resolveSystemOneProvider({ AI: ai, SYSTEM_ONE_PROVIDER: "clm", CLM_BASE_URL: "https://clm.example" })).toBe(
      "clm",
    );
  });

  it("does not replace Groq: systemOne is independent of LLM keys", () => {
    expect(resolveSystemOneProvider({ GROQ_API_KEY: "g", AI: { run: async () => ({}) } })).toBe("jev");
    expect(resolveSystemOneProvider({ GROQ_API_KEY: "g" })).toBe("off");
  });

  it("calls typesafe/jev and unwraps answers", async () => {
    const run = vi.fn(async (model, body) => {
      expect(model).toBe(JEV_MODEL_ID);
      expect(body.questions.ping.type).toBe("noul");
      return {
        result: {
          model: "jev-1.13.0",
          answers: { ping: { type: "noul", noul: 0.91 } },
        },
      };
    });
    const result = await systemOne(
      { AI: { run } },
      { state: "hello", questions: { ping: { type: "noul", instructions: "ok?" } } },
    );
    expect(result.ok).toBe(true);
    expect(result.answers.ping.noul).toBe(0.91);
    expect(unwrapSystemOnePayload({ answers: { a: 1 } }).answers.a).toBe(1);
  });

  it("cascades to jev when CLM margin is thin", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        model: "clm-latest",
        answers: { pick: { type: "choice", choice: "a", probabilities: { a: 0.51, b: 0.49 } } },
      }),
    );
    const run = vi.fn(async () => ({
      answers: { pick: { type: "choice", choice: "b", probabilities: { a: 0.1, b: 0.9 } } },
    }));
    const result = await systemOne(
      {
        SYSTEM_ONE_CASCADE: "clm_then_jev",
        CLM_BASE_URL: "https://clm.example",
        AI: { run },
      },
      {
        state: "x",
        questions: { pick: { type: "choice", instructions: "p", criteria: { a: "a", b: "b" } } },
        fetchImpl,
      },
    );
    expect(fetchImpl).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    expect(result.cascadedFrom).toBe("clm");
    expect(result.answers.pick.choice).toBe("b");
  });

  it("tool pass reorders only when needs_tool is high; escalate is a separate noul", async () => {
    const tools = [
      { type: "function", function: { name: "search" } },
      { type: "function", function: { name: "web_fetch" } },
    ];
    const pass = await applySystemOneToolPass(
      { AI: { run: async () => {} } },
      {
        state: "fetch the docs",
        tools,
        aiRun: async () => ({
          answers: {
            needs_tool: { type: "noul", noul: 0.92 },
            tool: { type: "choice", choice: "web_fetch" },
            escalate: { type: "noul", noul: 0.11 },
          },
        }),
      },
    );
    expect(pass.tools[0].function.name).toBe("web_fetch");
    expect(pass.decision.choice).toBe("web_fetch");
    expect(shouldSystemOneEscalate(pass.decision.escalate, {})).toBe(false);

    const skip = await applySystemOneToolPass(
      { AI: { run: async () => {} } },
      {
        state: "just say hi",
        tools,
        aiRun: async () => ({
          answers: {
            needs_tool: { type: "noul", noul: 0.1 },
            tool: { type: "choice", choice: "web_fetch" },
            escalate: { type: "noul", noul: 0.9 },
          },
        }),
      },
    );
    expect(skip.tools[0].function.name).toBe("search");
    expect(skip.decision.choice).toBeNull();
    expect(shouldSystemOneEscalate(skip.decision.escalate, {})).toBe(true);
  });

  it("HITL wrap works with Jev and no CLM_BASE_URL", async () => {
    const env = { AI: { run: async () => {} } };
    const gate = wrapClmApprovalGate({ needsApproval: async () => false }, env, {
      aiRun: async () => ({ answers: { hitl: { type: "noul", noul: 0.2 } } }),
    });
    expect(await gate.needsApproval("web_fetch", {}, {})).toBe(true);
  });
});
