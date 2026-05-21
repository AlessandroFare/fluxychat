import { describe, expect, it } from "vitest";
import {
  AGENT_PROMPT_TEMPLATES,
  findAgentPromptTemplate,
} from "./agent-prompt-templates";

describe("agent-prompt-templates", () => {
  it("includes built-in aligned templates", () => {
    expect(AGENT_PROMPT_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    expect(findAgentPromptTemplate("assistant")?.suggestedHandle).toBe("assistant");
  });
});
