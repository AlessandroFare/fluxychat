import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownBody } from "./markdown-body";

const PRICING = `FluxyChat offers a few pricing tiers:

| Plan | Monthly cost* | Core limits |
|------|---------------|-------------|
| **Free** | $0 | 1 000 messages/month |
| **Starter** | $49 / month | 50 000 messages/month |

\`\`\`bash
fluxy billing info
\`\`\`
`;

describe("MarkdownBody", () => {
  it("renders GFM tables as HTML tables", () => {
    const { container, getByText } = render(<MarkdownBody content={PRICING} />);
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(container.querySelectorAll("th").length).toBe(3);
    expect(getByText("Free")).toBeTruthy();
    expect(getByText("Starter")).toBeTruthy();
    expect(getByText("fluxy billing info")).toBeTruthy();
    expect(container.querySelector("pre code")).toBeTruthy();
  });

  it("renders markdown images with a safe https src", () => {
    const { container } = render(
      <MarkdownBody content={"![diagram](https://cdn.example.com/chart.png)"} />,
    );
    const img = container.querySelector("img");
    expect(img).toHaveAttribute("src", "https://cdn.example.com/chart.png");
    expect(img).toHaveAttribute("alt", "diagram");
  });

  it("does not render javascript: image URLs", () => {
    const { container } = render(
      <MarkdownBody content={"![xss](javascript:alert(1))"} />,
    );
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders mp4 markdown images as video controls", () => {
    const { container } = render(
      <MarkdownBody content={"![](https://cdn.example.com/clip.mp4)"} />,
    );
    expect(container.querySelector("video")).toHaveAttribute(
      "src",
      "https://cdn.example.com/clip.mp4",
    );
  });

  it("embeds YouTube watch URLs as youtube-nocookie iframes", () => {
    const { container } = render(
      <MarkdownBody content={"https://www.youtube.com/watch?v=dQw4w9WgXcQ"} />,
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.getAttribute("src")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});
