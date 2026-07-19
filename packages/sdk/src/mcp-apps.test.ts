import { describe, it, expect } from "vitest";
import {
  getMCPAppToolMeta,
  getMCPAppResourceUri,
  isMCPAppTool,
  splitMCPAppTools,
  getMCPAppResourceUris,
  getMCPAppResourceFromReadResult,
  createMCPAppManager,
} from "./mcp-apps";

describe("mcp-apps utilities", () => {
  it("getMCPAppToolMeta returns tool meta", () => {
    const tool = { _meta: { ui: { resourceUri: "ui://test" } } };
    expect(getMCPAppToolMeta(tool)).toEqual({ resourceUri: "ui://test" });
  });

  it("getMCPAppToolMeta returns undefined when no ui meta", () => {
    expect(getMCPAppToolMeta({})).toBeUndefined();
  });

  it("getMCPAppResourceUri extracts resource URI", () => {
    const tool = { _meta: { ui: { resourceUri: "ui://test" } } };
    expect(getMCPAppResourceUri(tool)).toBe("ui://test");
  });

  it("isMCPAppTool detects tool with ui:// resource", () => {
    const tool = { _meta: { ui: { resourceUri: "ui://test" } } };
    expect(isMCPAppTool(tool)).toBe(true);
  });

  it("isMCPAppTool returns false for non-mcp tools", () => {
    expect(isMCPAppTool({})).toBe(false);
    expect(isMCPAppTool({ _meta: { ui: { resourceUri: "http://test" } } })).toBe(false);
  });

  it("splitMCPAppTools separates model and app visible tools", () => {
    const modelTool = { name: "model_tool" };
    const appTool = { name: "app_tool", _meta: { ui: { visibility: ["app"] } } };
    const bothTool = {
      name: "both_tool",
      _meta: { ui: { visibility: ["model", "app"] } },
    };
    const { modelVisible, appVisible } = splitMCPAppTools({
      tools: [modelTool, appTool, bothTool],
    });
    expect(modelVisible.tools).toHaveLength(2);
    expect(modelVisible.tools.map((t) => t.name)).toEqual(["model_tool", "both_tool"]);
    expect(appVisible.tools).toHaveLength(2);
    expect(appVisible.tools.map((t) => t.name)).toEqual(["app_tool", "both_tool"]);
  });

  it("getMCPAppResourceUris returns unique URIs", () => {
    const uris = getMCPAppResourceUris({
      tools: [
        { name: "a", _meta: { ui: { resourceUri: "ui://x" } } },
        { name: "b", _meta: { ui: { resourceUri: "ui://y" } } },
        { name: "c", _meta: { ui: { resourceUri: "ui://x" } } },
      ],
    });
    expect(uris).toEqual(["ui://x", "ui://y"]);
  });

  it("getMCPAppResourceFromReadResult returns resource from text", () => {
    const resource = getMCPAppResourceFromReadResult({
      uri: "ui://test",
      resource: { text: "<html>test</html>", mimeType: "text/html;profile=mcp-app" },
    });
    expect(resource.html).toBe("<html>test</html>");
    expect(resource.mimeType).toBe("text/html;profile=mcp-app");
  });

  it("createMCPAppManager provides unified interface", () => {
    const mgr = createMCPAppManager();
    expect(mgr.isMCPAppTool({ _meta: { ui: { resourceUri: "ui://test" } } })).toBe(true);
    expect(mgr.isMCPAppTool({})).toBe(false);
    expect(mgr.getAppMeta({ _meta: { ui: { resourceUri: "ui://x" } } })).toEqual({
      resourceUri: "ui://x",
    });
    const { modelVisible, appVisible } = mgr.splitTools({
      tools: [
        { name: "a" },
        { name: "b", _meta: { ui: { visibility: ["app"] } } },
      ],
    });
    expect(modelVisible.tools).toHaveLength(1);
    expect(appVisible.tools).toHaveLength(1);
  });
});
