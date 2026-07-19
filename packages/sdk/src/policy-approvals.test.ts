import { describe, it, expect } from "vitest";
import { createPolicyEngine } from "./policy-approvals";

describe("policy-approvals", () => {
  it("should add policies sorted by priority", () => {
    const pe = createPolicyEngine();
    pe.addPolicy({ policyId: "p1", name: "High priority", rego: "allow", mode: "enforcing", transitive: false, priority: 100 });
    pe.addPolicy({ policyId: "p2", name: "Low priority", rego: "allow", mode: "enforcing", transitive: false, priority: 10 });
    const list = pe.listPolicies();
    expect(list[0].priority).toBe(100);
  });

  it("should evaluate to allow when no deny rules match", () => {
    const pe = createPolicyEngine();
    pe.addPolicy({ policyId: "allow-all", name: "Allow all", rego: "allow { true }", mode: "enforcing", transitive: false, priority: 0 });
    const decision = pe.evaluate({ action: "read", resource: "chat:room:1", subject: { id: "u1", roles: ["user"], attributes: {} }, context: {} });
    expect(decision.allowed).toBe(true);
  });

  it("should deny when deny policy matches", () => {
    const pe = createPolicyEngine();
    pe.addPolicy({ policyId: "deny-sensitive", name: "Deny sensitive", rego: "deny { input.resource == \"chat:room:admin\" }", mode: "enforcing", transitive: false, priority: 50 });
    const decision = pe.evaluate({ action: "write", resource: "chat:room:admin", subject: { id: "u1", roles: ["user"], attributes: {} }, context: {} });
    expect(decision.allowed).toBe(false);
    expect(decision.effect).toBe("deny");
  });

  it("should shadow deny in shadow mode", () => {
    const pe = createPolicyEngine();
    pe.addPolicy({ policyId: "shadow", name: "Shadow deny", rego: "deny { true }", mode: "shadow", transitive: false, priority: 50 });
    const decision = pe.evaluate({ action: "read", resource: "x", subject: { id: "u1", roles: [], attributes: {} }, context: {} });
    expect(decision.allowed).toBe(true);
    expect(decision.effect).toBe("shadow_deny");
  });

  it("should evaluate transitive", () => {
    const pe = createPolicyEngine();
    pe.addPolicy({ policyId: "parent", name: "Parent", rego: "deny { input.context.parent_decision != null }", mode: "enforcing", transitive: false, priority: 50 });
    const decision = pe.evaluateTransitive({ action: "read", resource: "x", subject: { id: "u1", roles: [], attributes: {} }, context: {} });
    expect(decision.allowed).toBe(false);
  });

  it("should allow by default when no policies match", () => {
    const pe = createPolicyEngine();
    const decision = pe.evaluate({ action: "read", resource: "x", subject: { id: "u1", roles: [], attributes: {} }, context: {} });
    expect(decision.allowed).toBe(true);
  });
});
