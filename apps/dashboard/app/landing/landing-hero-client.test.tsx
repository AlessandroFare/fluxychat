import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { LandingHeroClient } from "./landing-hero-client";

// Mock client-side checks so the component renders without errors
vi.mock("@/lib/hosted-product", () => ({
  isClerkClientConfigured: vi.fn(() => false),
  HOSTED_PATHS: { signUp: "/sign-up", getStarted: "/get-started", onboarding: "/onboarding" },
  HOSTED_COPY: { startFree: "Start free", signIn: "Sign in", console: "Console" },
  hostedSignupRedirect: vi.fn(() => "/onboarding"),
}));

vi.mock("./landing-shared", () => ({
  INSTALL_CMD: "pnpm add @fluxy-chat/react",
}));

vi.mock("@/lib/marketing-landing", () => ({
  MARKETING_HERO: {
    eyebrow: "test eyebrow",
    headlineLead: "test lead",
    headlineAccent: "test accent",
    subhead: "test subhead",
  },
}));

vi.mock("~/components/marketing/grainient", () => ({
  Grainient: () => <div data-testid="mock-grainient" />,
}));

vi.mock("next/dynamic", () => ({
  default: () => () => null,
}));

// Partial mock — keep real icons for product nav, stub Copy/Check for clipboard test
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Check: ({ className }: { className?: string }) => (
      <svg data-testid="check-icon" className={className} />
    ),
    Copy: ({ className }: { className?: string }) => (
      <svg data-testid="copy-icon" className={className} />
    ),
  };
});

// Mock clipboard API — assign to global (jsdom uses a frozen navigator)
beforeAll(() => {
  Object.assign(navigator, { clipboard: { writeText: vi.fn(() => Promise.resolve()) } });
});

describe("LandingHeroClient", () => {
  afterEach(cleanup);

  it("renders the install command in a dark terminal-style chip", () => {
    render(<LandingHeroClient />);

    // The install command text should be present
    const codeEl = screen.getByText("pnpm add @fluxy-chat/react");
    expect(codeEl).toBeInTheDocument();
    expect(codeEl.tagName).toBe("CODE");
    expect(codeEl).toHaveClass("font-mono");
    expect(codeEl).toHaveClass("text-slate-100");

    // The surrounding container should have the dark terminal chip styles
    const chip = codeEl.closest("div");
    expect(chip).toBeTruthy();
    expect(chip!).toHaveClass("bg-[#1A1A1A]");
    expect(chip!).toHaveClass("border-white/10");
    expect(chip!).toHaveClass("rounded-lg");
    expect(chip!).toHaveClass("h-[52px]");

    // The parent wrapper (flex container) should center both CTAs
    const wrapper = chip!.parentElement;
    expect(wrapper).toHaveClass("items-center");
    expect(wrapper).toHaveClass("justify-center");
  });

  it("shows the copy icon button with correct styling", () => {
    render(<LandingHeroClient />);

    const copyButton = screen.getByTestId("copy-button");
    expect(copyButton).toBeInTheDocument();
    expect(copyButton).toHaveClass("text-slate-400");
  });

  it("shows a check icon after copy", () => {
    render(<LandingHeroClient />);

    const copyButton = screen.getByTestId("copy-button");
    fireEvent.click(copyButton);

    // After copy, the check icon should appear
    const checkIcon = screen.getByTestId("check-icon");
    expect(checkIcon).toBeInTheDocument();

    // The copy button should no longer be present (replaced by the check + green text)
    expect(screen.queryByTestId("copy-button")).not.toBeInTheDocument();
  });

});