import * as React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Bubble, BubbleContent } from "./bubble";

describe("Bubble brand tokens", () => {
  it("sent variant applies CSS custom properties for background, text, and radii", () => {
    const { container } = render(
      <Bubble variant="sent" align="end">
        <BubbleContent>Hello</BubbleContent>
      </Bubble>
    );

    const content = container.querySelector('[data-slot="bubble-content"]');
    expect(content).not.toBeNull();
    const className = content?.className ?? "";

    expect(className).toContain("bg-[var(--fluxy-bubble-sent-bg)]");
    expect(className).toContain("text-[var(--fluxy-bubble-sent-text)]");
    expect(className).toContain("rounded-2xl");
    expect(className).toContain("rounded-br-md");
    expect(className).not.toMatch(/#FF6A1A/i);
    expect(className).not.toMatch(/#C2410C/i);
  });

  it("received variant applies CSS custom properties for background, border, text, and radii", () => {
    const { container } = render(
      <Bubble variant="received" align="start">
        <BubbleContent>World</BubbleContent>
      </Bubble>
    );

    const content = container.querySelector('[data-slot="bubble-content"]');
    expect(content).not.toBeNull();
    const className = content?.className ?? "";

    expect(className).toContain("bg-[var(--fluxy-bubble-received-bg)]");
    expect(className).toContain("text-[var(--fluxy-bubble-received-text)]");
    expect(className).toContain("shadow-[inset_0_0_0_1px_var(--fluxy-bubble-received-border)]");
    expect(className).toContain("rounded-2xl");
    expect(className).toContain("rounded-bl-md");
    expect(className).not.toMatch(/#FF6A1A/i);
    expect(className).not.toMatch(/#C2410C/i);
  });

  it("align end is preserved regardless of variant", () => {
    const { container } = render(
      <Bubble variant="received" align="end" data-testid="bubble">
        <BubbleContent>Aligned end</BubbleContent>
      </Bubble>
    );

    const bubble = container.querySelector('[data-testid="bubble"]');
    expect(bubble?.getAttribute("data-align")).toBe("end");
  });
});
