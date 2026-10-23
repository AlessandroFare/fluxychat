import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ configured: true, isLoaded: true, isSignedIn: false }));

vi.mock("@/lib/hosted-product", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/hosted-product")>();
  return { ...actual, isClerkClientConfigured: () => state.configured };
});

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: state.isLoaded, isSignedIn: state.isSignedIn }),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/app/components/theme-provider", () => ({
  useTheme: () => ({ resolvedTheme: "dark" }),
}));

import { LandingHeroAuthCta, LandingNavAuthCta } from "./landing-auth-cta";

describe("landing auth CTA", () => {
  afterEach(cleanup);

  beforeEach(() => {
    state.configured = true;
    state.isLoaded = true;
    state.isSignedIn = false;
  });

  it("signed-in users get Open console instead of sign-up", () => {
    state.isSignedIn = true;
    render(<LandingNavAuthCta />);
    expect(screen.getByRole("link", { name: /open console/i })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("button", { name: /create free account/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /sign in/i })).toBeNull();
  });

  it("hero shows Open console when signed in", () => {
    state.isSignedIn = true;
    render(<LandingHeroAuthCta />);
    expect(screen.getByRole("link", { name: /open console/i })).toHaveAttribute("href", "/dashboard");
  });

  it("guests keep sign-in and create-account", () => {
    render(<LandingNavAuthCta />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create free account/i })).toBeInTheDocument();
  });

  it("self-host without Clerk keeps the get-started CTA", () => {
    state.configured = false;
    render(<LandingNavAuthCta />);
    expect(screen.getByRole("link", { name: /create free account/i })).toHaveAttribute(
      "href",
      "/get-started",
    );
  });
});
