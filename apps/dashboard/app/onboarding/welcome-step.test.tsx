import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const hosted = vi.hoisted(() => ({ configured: true }));

vi.mock("@/lib/hosted-product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hosted-product")>();
  return { ...actual, isClerkClientConfigured: () => hosted.configured };
});

import { WelcomeStep } from "./welcome-step";
import type { OnboardingWizard } from "./use-onboarding-wizard";

const signedOutWizard = { clerkSignedIn: false, adminJwt: "" } as unknown as OnboardingWizard;

afterEach(cleanup);

describe("WelcomeStep skip affordance", () => {
  it("hosted: asks to sign in, links the guest demo room, no dead link to the gated console", () => {
    hosted.configured = true;
    render(<WelcomeStep wizard={signedOutWizard} />);
    expect(screen.getByText(/Next step asks you to sign in/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /console/i })).toBeNull();
    expect(screen.getByRole("link", { name: /demo room/i })).toHaveAttribute("href", "/demo");
  });

  it("self-host: skips ahead to the console that is actually reachable", () => {
    hosted.configured = false;
    render(<WelcomeStep wizard={signedOutWizard} />);
    const link = screen.getByRole("link", { name: /console/i });
    expect(link).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: /demo room/i })).toHaveAttribute("href", "/demo");
  });
});
