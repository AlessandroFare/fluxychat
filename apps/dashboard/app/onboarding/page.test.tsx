import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSessionProvider } from "../components/dashboard-session";
import OnboardingPage from "./page";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ user: null, isSignedIn: false }),
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

describe("OnboardingPage", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("resumes at first incomplete step after session hydrates", async () => {
    window.sessionStorage.setItem(
      "fluxychat.dashboard.session.v1",
      JSON.stringify({
        adminJwt: "admin.jwt.token.long.enough",
        memberJwt: "member.jwt.token",
        activeProject: {
          id: "proj_1",
          name: "Demo Project",
          apiKey: "fc_demo",
        },
      }),
    );

    render(
      <DashboardSessionProvider>
        <OnboardingPage />
      </DashboardSessionProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Quickstart wizard/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/Step 4 of 6/i)).toBeInTheDocument();
    });

    expect(screen.getByTestId("create-room-btn")).toBeInTheDocument();
  });
});
