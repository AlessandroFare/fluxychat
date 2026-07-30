import { describe, it, expect } from "vitest";
import { createModal, createTextStep, createSelectStep, createConfirmStep, createFileStep, createModalManager } from "./modal-context";

describe("createModal", () => {
  it("creates a modal definition with steps", () => {
    const modal = createModal("feedback", "Feedback")
      .addStep(createTextStep("name", "Your name"))
      .addStep(createSelectStep("rating", "Rating", [{ label: "Good", value: "good" }, { label: "Bad", value: "bad" }]))
      .addStep(createConfirmStep("submit", "Submit?"))
      .build();

    expect(modal.id).toBe("feedback");
    expect(modal.title).toBe("Feedback");
    expect(modal.steps).toHaveLength(3);
    expect(modal.steps[0].type).toBe("text");
    expect(modal.steps[1].type).toBe("select");
    expect(modal.steps[1].options).toHaveLength(2);
    expect(modal.steps[2].type).toBe("confirm");
  });

  it("supports description and file step", () => {
    const modal = createModal("upload", "Upload", "Upload a file")
      .addStep(createFileStep("file", "Choose file"))
      .build();

    expect(modal.description).toBe("Upload a file");
    expect(modal.steps[0].type).toBe("file");
  });
});

describe("createModalManager", () => {
  it("opens a modal and returns state", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    const state = mgr.open(modal, "user:1");

    expect(state.status).toBe("active");
    expect(state.userId).toBe("user:1");
    expect(state.currentStep).toBe(0);
  });

  it("submit advances step", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test")
      .addStep(createTextStep("name", "Name"))
      .addStep(createTextStep("email", "Email"))
      .build();
    const state = mgr.open(modal, "user:1");

    const s1 = mgr.submit(state.id, "user:1", "Alice");
    expect(s1.currentStep).toBe(1);

    const s2 = mgr.submit(s1.id, "user:1", "alice@example.com", true);
    expect(s2.status).toBe("completed");
  });

  it("submit with done flag completes the modal", () => {
    const mgr = createModalManager();
    const modal = createModal("single", "Single").addStep(createTextStep("x", "X")).build();
    const state = mgr.open(modal, "user:1");

    const result = mgr.submit(state.id, "user:1", "value", true);
    expect(result.status).toBe("completed");
  });

  it("cancel changes status to cancelled", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    const state = mgr.open(modal, "user:1");

    expect(mgr.cancel(state.id, "user:1")).toBe(true);
    expect(mgr.getState(state.id)?.status).toBe("cancelled");
  });

  it("cancel returns false for wrong user", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    const state = mgr.open(modal, "user:1");

    expect(mgr.cancel(state.id, "user:2")).toBe(false);
  });

  it("getUserModals returns active modals for user", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    mgr.open(modal, "user:1");
    mgr.open(modal, "user:1");
    mgr.open(modal, "user:2");

    expect(mgr.getUserModals("user:1")).toHaveLength(2);
    expect(mgr.getUserModals("user:2")).toHaveLength(1);
  });

  it("cleanup expires stale modals", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test", undefined).build();
    modal.expiresAt = Date.now() - 1000;
    const state = mgr.open(modal, "user:1");

    const expired = mgr.cleanup();
    expect(expired).toBe(1);
    expect(mgr.getState(state.id)?.status).toBe("expired");
  });

  it("submit throws for inactive modal", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    const state = mgr.open(modal, "user:1");
    mgr.cancel(state.id, "user:1");

    expect(() => mgr.submit(state.id, "user:1", "x")).toThrow("not active");
  });

  it("submit throws for wrong user", () => {
    const mgr = createModalManager();
    const modal = createModal("test", "Test").build();
    const state = mgr.open(modal, "user:1");

    expect(() => mgr.submit(state.id, "user:2", "x")).toThrow("not found");
  });
});
