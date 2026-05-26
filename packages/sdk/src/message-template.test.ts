import { describe, expect, it } from "vitest";
import { extractTemplateVarNames, renderMessageTemplate } from "./message-template";

describe("message-template", () => {
  it("extractTemplateVarNames returns unique keys in order", () => {
    expect(
      extractTemplateVarNames("Hi {{name}}, room {{room}} and {{name}} again."),
    ).toEqual(["name", "room"]);
  });

  it("renderMessageTemplate substitutes vars", () => {
    expect(renderMessageTemplate("Hello {{name}}", { name: "Ada" })).toBe("Hello Ada");
  });
});
