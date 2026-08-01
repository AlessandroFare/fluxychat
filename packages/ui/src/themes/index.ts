import { FLUXY_THEMES, type FluxyThemeId, type FluxyThemeTokens } from "./presets";

export { FLUXY_THEME_IDS, FLUXY_THEMES } from "./presets";
export type { FluxyThemeId, FluxyThemeTokens } from "./presets";

/** CSS class applied by `applyFluxyTheme` for scoped theme wrappers. */
export function fluxyThemeClassName(themeId: FluxyThemeId): string {
  return `fluxy-theme-${themeId}`;
}

/** Inline style object for React `style` prop on a chat root wrapper. */
export function fluxyThemeStyle(themeId: FluxyThemeId): Record<string, string> {
  return { ...FLUXY_THEMES[themeId] };
}

/** Apply theme tokens to a DOM element (defaults to `:root`). */
export function applyFluxyTheme(
  themeId: FluxyThemeId,
  target: HTMLElement = document.documentElement,
): void {
  const tokens = FLUXY_THEMES[themeId];
  for (const [key, value] of Object.entries(tokens)) {
    target.style.setProperty(key, value);
  }
  for (const id of Object.keys(FLUXY_THEMES)) {
    target.classList.toggle(fluxyThemeClassName(id as FluxyThemeId), id === themeId);
  }
}

/** Generate a CSS block for a theme class (import in global CSS or inject once). */
export function getFluxyThemeCss(themeId: FluxyThemeId): string {
  const tokens = FLUXY_THEMES[themeId];
  const lines = Object.entries(tokens)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
  return `.${fluxyThemeClassName(themeId)} {\n${lines}\n}`;
}

/** All preset CSS blocks concatenated. */
export function getAllFluxyThemesCss(): string {
  return (Object.keys(FLUXY_THEMES) as FluxyThemeId[])
    .map((id) => getFluxyThemeCss(id))
    .join("\n\n");
}
