import { describe, expect, it } from "vitest";
import { tokenizeCode } from "./landing-code";

describe("tokenizeCode", () => {
  it("reassembles the source exactly", () => {
    const source = `import { Widget } from "@scope/pkg";\nconst el = <Widget roomId="general" />; // note`;
    expect(tokenizeCode(source).map((token) => token.text).join("")).toBe(source);
  });

  it("tags strings, keywords, components and props", () => {
    const tokens = tokenizeCode(
      `import { Widget } from "@scope/pkg";\nconst el = <Widget roomId="general" />;`,
    );
    const kinds = new Map(tokens.map((token) => [token.text, token.kind]));

    expect(kinds.get('"@scope/pkg"')).toBe("string");
    expect(kinds.get("import")).toBe("keyword");
    expect(kinds.get("Widget")).toBe("tag");
    expect(kinds.get("roomId")).toBe("attr");
  });
});
