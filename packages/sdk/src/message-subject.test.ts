import { describe, it, expect } from "vitest";
import { createSubject, subjectToString, subjectToUrl } from "./message-subject";

describe("createSubject", () => {
  it("creates a subject with required fields", () => {
    const s = createSubject("github-issue", "42");
    expect(s.type).toBe("github-issue");
    expect(s.id).toBe("42");
  });

  it("includes optional fields", () => {
    const s = createSubject("linear-issue", "ABC-123", { title: "Fix bug", status: "in-progress" });
    expect(s.title).toBe("Fix bug");
    expect(s.status).toBe("in-progress");
  });
});

describe("subjectToString", () => {
  it("formats GitHub issue", () => {
    expect(subjectToString(createSubject("github-issue", "42", { title: "Bug" }))).toBe("#42: Bug");
  });

  it("formats GitHub PR", () => {
    expect(subjectToString(createSubject("github-pr", "100"))).toBe("!100");
  });

  it("formats Linear issue", () => {
    expect(subjectToString(createSubject("linear-issue", "ABC-123", { title: "Feature" }))).toBe("LIN-ABC-123: Feature");
  });
});

describe("subjectToUrl", () => {
  it("returns custom url if set", () => {
    expect(subjectToUrl(createSubject("url", "1", { url: "https://example.com/1" }))).toBe("https://example.com/1");
  });

  it("generates GitHub issue URL", () => {
    expect(subjectToUrl(createSubject("github-issue", "42"))).toBe("https://github.com/issues/42");
  });

  it("generates GitHub PR URL", () => {
    expect(subjectToUrl(createSubject("github-pr", "100"))).toBe("https://github.com/pulls/100");
  });

  it("returns null for unknown type without url", () => {
    expect(subjectToUrl(createSubject("jira-ticket", "ABC-123"))).toBeNull();
  });
});
