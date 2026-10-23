import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomEmojiText } from "./custom-emoji-text";

afterEach(cleanup);

describe("CustomEmojiText", () => {
  it("renders known :name: tokens as images", () => {
    render(
      <CustomEmojiText
        text="ship it :parrot: now"
        emojis={[{ name: "parrot", imageUrl: "https://cdn.test/parrot.png" }]}
      />,
    );
    const img = screen.getByAltText(":parrot:");
    expect(img).toHaveAttribute("src", "https://cdn.test/parrot.png");
    expect(screen.getByText(/ship it/)).toBeInTheDocument();
  });

  it("leaves unknown tokens and plain text unchanged", () => {
    const { container } = render(
      <CustomEmojiText text="hello :unknown:" emojis={[]} />,
    );
    expect(container.textContent).toBe("hello :unknown:");
    expect(container.querySelector("img")).toBeNull();
  });
});
