import { describe, expect, it } from "vitest";
import { applyInputGuardrails, applyOutputGuardrails, normalizeGuardrails } from "./ops-guardrails.js";

const GUARDRAILS = {
  enabled: true,
  block: [{ name: "aws_key", pattern: "AKIA[0-9A-Z]{16}" }],
  redact: [{ name: "email", pattern: "[\\w.+-]+@[\\w-]+\\.[\\w.]+" }],
};

describe("ops-guardrails", () => {
  it("normalizes rules, dropping invalid patterns and inactive config", () => {
    expect(normalizeGuardrails(null)).toEqual({ enabled: false, block: [], redact: [] });
    const normalized = normalizeGuardrails({
      enabled: "true",
      block: [
        { name: "bad name!!", pattern: "x" },
        { name: "broken", pattern: "(" },
        { name: "", pattern: "x" },
      ],
      redact: [{ name: "ok", pattern: "y" }],
    });
    expect(normalized.enabled).toBe(true);
    expect(normalized.block).toEqual([{ name: "badname", pattern: "x" }]);
    expect(normalized.redact).toEqual([{ name: "ok", pattern: "y" }]);
  });

  it("blocks a call on an input match, before it leaves", () => {
    const blocked = applyInputGuardrails(GUARDRAILS, { note: "key AKIA1234567890ABCDEF here" });
    expect(blocked).toMatchObject({ ok: false, error: "guardrail_blocked", rule: "aws_key", stage: "input" });
    const clean = applyInputGuardrails(GUARDRAILS, { note: "hello" });
    expect(clean.ok).toBe(true);
    expect(clean.redacted).toEqual([]);
  });

  it("redacts input matches anywhere in the payload and names the rule", () => {
    const result = applyInputGuardrails(GUARDRAILS, { contact: "a@b.co", nested: { list: ["c@d.io"] } });
    expect(result.ok).toBe(true);
    expect(result.input).toEqual({ contact: "[redacted:email]", nested: { list: ["[redacted:email]"] } });
    expect(result.redacted).toEqual(["email"]);
  });

  it("scans output payloads and drops them when a block rule matches", () => {
    const redacted = applyOutputGuardrails(GUARDRAILS, { content: "mail me at x@y.dev", structured: { email: "z@w.org" } });
    expect(redacted.ok).toBe(true);
    expect(redacted.payload.content).toBe("mail me at [redacted:email]");
    expect(redacted.payload.structured.email).toBe("[redacted:email]");
    expect(redacted.redacted).toEqual(["email"]);

    const blocked = applyOutputGuardrails(GUARDRAILS, { content: "AKIA9999999999999999" });
    expect(blocked).toMatchObject({ ok: false, error: "guardrail_blocked", rule: "aws_key", stage: "output" });
  });

  it("is inert when disabled", () => {
    const out = applyOutputGuardrails({ enabled: false, block: [], redact: [] }, { content: "AKIA9999999999999999" });
    expect(out.ok).toBe(true);
    expect(out.payload.content).toBe("AKIA9999999999999999");
  });
});
