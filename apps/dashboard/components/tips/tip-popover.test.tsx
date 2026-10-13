import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TipPopover } from "./tip-popover";

describe("TipPopover", () => {
  it("lets the target stay clickable while the tip is open", () => {
    const onTarget = vi.fn();
    function Harness() {
      return (
        <div>
          <button type="button" data-tour="target" onClick={onTarget}>
            composer
          </button>
          <TipPopover
            target='[data-tour="target"]'
            title="First Chat"
            body="Mention @assistant"
            onNext={() => {}}
            onDismiss={() => {}}
            onReplay={() => {}}
          />
        </div>
      );
    }

    render(<Harness />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "composer" }));
    expect(onTarget).toHaveBeenCalledTimes(1);
  });
});
