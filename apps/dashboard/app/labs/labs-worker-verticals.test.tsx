import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LABS_WORKER_VERTICALS, LabsWorkerVerticals } from "./labs-worker-verticals";

describe("LabsWorkerVerticals", () => {
  afterEach(cleanup);

  it("deep-links the four worker verticals with honest order", () => {
    expect(LABS_WORKER_VERTICALS.map((v) => v.href)).toEqual(["/stream", "/game", "/iot", "/fleet"]);
    render(<LabsWorkerVerticals />);
    for (const vertical of LABS_WORKER_VERTICALS) {
      const link = screen.getByRole("link", { name: new RegExp(vertical.label, "i") });
      expect(link).toHaveAttribute("href", vertical.href);
    }
  });
});
