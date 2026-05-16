import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scopedStorageKey } from "@/lib/scoped-browser-storage";
import { DashboardSessionProvider } from "../components/dashboard-session";
import { ClerkSessionBinder } from "../components/clerk-session-binder";
import OnboardingPage from "./page";

const CLERK_USER_ID = "user_test_abc";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({
    user: { id: CLERK_USER_ID },
    isSignedIn: true,
    isLoaded: true,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/onboarding",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@fluxy-chat/sdk", () => ({
  FluxyChatClient: function FluxyChatClient() {
    return {};
  },
  useChat: () => ({
    messages: [],
    sendMessage: vi.fn(),
    connectionStatus: "disconnected",
  }),
}));

const SESSION_KEY = scopedStorageKey("fluxychat.dashboard.session.v1", CLERK_USER_ID);

describe("OnboardingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("always starts at step 1 (connect) for a scoped session", async () => {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        adminJwt: "admin.jwt.token.long.enough",
        memberJwt: "member.jwt.token.long.enough",
        activeProject: {
          id: "proj_1",
          name: "Demo Project",
          apiKey: "fc_demo",
        },
      }),
    );

    render(
      <DashboardSessionProvider>
        <ClerkSessionBinder />
        <OnboardingPage />
      </DashboardSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    });
  });
});
