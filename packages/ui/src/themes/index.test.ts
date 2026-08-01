import { describe, expect, it } from "vitest";
import {
  FLUXY_THEME_IDS,
  FLUXY_THEMES,
  fluxyThemeClassName,
  getFluxyThemeCss,
} from "./index";

describe("fluxy themes", () => {
  it("defines four presets", () => {
    expect(FLUXY_THEME_IDS).toHaveLength(4);
    for (const id of FLUXY_THEME_IDS) {
      expect(FLUXY_THEMES[id]["--fluxy-bubble-sent-bg"]).toBeTruthy();
    }
  });

  it("generates CSS class blocks", () => {
    const css = getFluxyThemeCss("brand");
    expect(css).toContain(".fluxy-theme-brand");
    expect(css).toContain("--fluxy-bubble-sent-bg");
  });

  it("uses stable class names", () => {
    expect(fluxyThemeClassName("minimal")).toBe("fluxy-theme-minimal");
  });
});
