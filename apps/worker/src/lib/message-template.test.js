import { describe, expect, it } from "vitest";
import { renderMessageTemplate } from "./message-template.js";

describe("renderMessageTemplate", () => {
  it("substitutes variables", () => {
    expect(
      renderMessageTemplate("Hi {{name}}, order {{orderId}}", {
        name: "Jane",
        orderId: "42",
      }),
    ).toBe("Hi Jane, order 42");
  });

  it("leaves unknown vars empty", () => {
    expect(renderMessageTemplate("Hi {{name}}", {})).toBe("Hi ");
  });
});
