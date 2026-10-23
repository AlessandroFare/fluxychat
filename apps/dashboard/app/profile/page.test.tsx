import "@testing-library/jest-dom/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  replace: vi.fn(),
  clerkUserId: null as string | null,
  hasHydrated: true,
  memberJwt: "",
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: state.replace }),
}));

vi.mock("@/lib/clerk-user", () => ({
  useClerkUser: () => ({ user: state.clerkUserId ? { id: state.clerkUserId } : null }),
}));

vi.mock("@/lib/fluxy-clerk-user", () => ({
  fluxyUserIdFromClerk: (id: string) => `fluxy-${id}`,
}));

vi.mock("../components/dashboard-session", () => ({
  useDashboardSession: () => ({
    hasHydrated: state.hasHydrated,
    memberJwt: state.memberJwt,
  }),
}));

import ProfileRedirect from "./page";

function tokenWithSub(sub: string): string {
  const payload = btoa(JSON.stringify({ sub }))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}

describe("profile redirect", () => {
  beforeEach(() => {
    state.replace.mockReset();
    state.clerkUserId = null;
    state.hasHydrated = true;
    state.memberJwt = "";
  });

  afterEach(cleanup);

  it("sends Clerk users to their fluxy user page", async () => {
    state.clerkUserId = "user_123";
    render(<ProfileRedirect />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/users/fluxy-user_123"));
  });

  it("resolves the self-host member JWT subject", async () => {
    state.memberJwt = tokenWithSub("usr_self");
    render(<ProfileRedirect />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/users/usr_self"));
  });

  it("sends visitors without a session to Quickstart, not to marketing", async () => {
    render(<ProfileRedirect />);
    await waitFor(() => expect(state.replace).toHaveBeenCalledWith("/onboarding"));
  });

  it("waits for hydration before redirecting", async () => {
    state.hasHydrated = false;
    render(<ProfileRedirect />);
    expect(state.replace).not.toHaveBeenCalled();
  });
});
