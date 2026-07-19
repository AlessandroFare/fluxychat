import { describe, expect, it } from "vitest";

import { Portal } from "./index.js";

describe("@portalsdk/core", () => {
  it("constructs a Portal without touching the network", () => {
    const portal = new Portal({ apiKey: "pk_test", token: "jwt" });
    expect(portal).toBeInstanceOf(Portal);
  });
});
