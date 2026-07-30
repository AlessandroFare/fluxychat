import { describe, it, expect } from "vitest";
import { createGuiSandboxManager } from "./gui-sandbox";

describe("gui-sandbox", () => {
  it("should register a component", () => {
    const g = createGuiSandboxManager();
    const comp = g.registerComponent("comp-1", "<div>hello</div>");
    expect(comp.status).toBe("pending");
  });

  it("should render a component", () => {
    const g = createGuiSandboxManager();
    g.registerComponent("comp-1", "<div>hello</div>");
    const result = g.renderComponent("comp-1");
    expect(result.iframeUrl).toBe("sandbox://comp-1");
    expect(result.sandboxAttributes).toContain("allow-scripts");
  });

  it("should grant capabilities", () => {
    const g = createGuiSandboxManager();
    g.registerComponent("comp-1", "<div>hello</div>");
    const grant = g.grantCapability("comp-1", ["clipboard-read", "notification"]);
    expect(grant.capabilities).toContain("clipboard-read");
  });

  it("should revoke a component", () => {
    const g = createGuiSandboxManager();
    g.registerComponent("comp-1", "<div>hello</div>");
    g.revokeComponent("comp-1");
    expect(g.getComponent("comp-1")?.status).toBe("revoked");
  });

  it("should list components", () => {
    const g = createGuiSandboxManager();
    g.registerComponent("c1", "<div>1</div>");
    g.registerComponent("c2", "<div>2</div>");
    expect(g.listComponents()).toHaveLength(2);
  });

  it("should return error for unregistered component render", () => {
    const g = createGuiSandboxManager();
    const result = g.renderComponent("no-exist");
    expect(result.error).toContain("not found");
  });
});
