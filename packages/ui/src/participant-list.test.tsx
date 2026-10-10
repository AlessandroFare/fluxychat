import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ParticipantList } from "./participant-list";

describe("ParticipantList", () => {
  it("puts self first and counts extra watchers", () => {
    render(
      <ParticipantList
        selfId="bob"
        connections={5}
        people={[
          { userId: "ada", name: "Ada" },
          { userId: "bob", name: "Bob" },
        ]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items[0]?.textContent).toContain("Bob");
    expect(items[0]?.getAttribute("data-self")).toBe("true");
    expect(screen.getByText("3 watching")).toBeTruthy();
  });
});
