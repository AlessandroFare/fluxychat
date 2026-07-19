import { describe, it, expect } from "vitest";
import { createComposableUIKit } from "./composable-ui";

describe("createComposableUIKit", () => {
  it("returns default components for react", () => {
    const ui = createComposableUIKit();
    const comp = ui.getComponent("ChannelList", "react");
    expect(comp).toBeDefined();
    expect(comp!.name).toBe("ChannelList");
  });

  it("returns undefined for unknown component", () => {
    const ui = createComposableUIKit();
    expect(ui.getComponent("Unknown", "react")).toBeUndefined();
  });

  it("registerComponent adds new component", () => {
    const ui = createComposableUIKit();
    ui.registerComponent({ name: "CustomCard", framework: "vue", props: {} });
    const comp = ui.getComponent("CustomCard", "vue");
    expect(comp).toBeDefined();
  });

  it("getRegisteredComponents filters by framework", () => {
    const ui = createComposableUIKit();
    ui.registerComponent({ name: "VueComp", framework: "vue", props: {} });
    const vueComps = ui.getRegisteredComponents("vue");
    expect(vueComps.length).toBeGreaterThan(0);
    expect(vueComps.every((c) => c.framework === "vue")).toBe(true);
  });

  it("setChannelListConfig merges config", () => {
    const ui = createComposableUIKit();
    ui.setChannelListConfig({ showUnread: false });
    expect(ui.getChannelListConfig().showUnread).toBe(false);
    expect(ui.getChannelListConfig().showAvatars).toBe(true);
  });

  it("setThreadViewConfig merges config", () => {
    const ui = createComposableUIKit();
    ui.setThreadViewConfig({ maxThreadDepth: 5 });
    expect(ui.getThreadViewConfig().maxThreadDepth).toBe(5);
  });

  it("setMessageListConfig merges config", () => {
    const ui = createComposableUIKit();
    ui.setMessageListConfig({ maxVisible: 100 });
    expect(ui.getMessageListConfig().maxVisible).toBe(100);
  });

  it("setComposerConfig merges config", () => {
    const ui = createComposableUIKit();
    ui.setComposerConfig({ placeholder: "Say something..." });
    expect(ui.getComposerConfig().placeholder).toBe("Say something...");
  });

  it("createTheme returns default theme with overrides", () => {
    const ui = createComposableUIKit();
    const theme = ui.createTheme({ "--accent": "#ff0000" });
    expect(theme["--accent"]).toBe("#ff0000");
    expect(theme["--bg-primary"]).toBe("#ffffff");
  });
});
