import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AvatarStack, orderAvatarStack } from "./avatar-stack";

describe("AvatarStack", () => {
  const people = [
    { userId: "ada", name: "Ada" },
    { userId: "bob", name: "Bob" },
    { userId: "cam", name: "Cam" },
  ];

  it("puts self first and overflows others", () => {
    expect(orderAvatarStack(people, "bob")).toEqual({
      self: people[1],
      others: [people[0], people[2]],
    });
    render(<AvatarStack people={people} selfId="bob" max={2} />);
    expect(screen.getByLabelText("3 in room").textContent).toContain("+1");
    expect(screen.getByTitle("Bob").getAttribute("data-self")).toBe("true");
  });
});
