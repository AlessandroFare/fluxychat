import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardSessionProvider } from "../components/dashboard-session";
import OnboardingPage from "./page";

vi.mock("@fluxychat/sdk", () => ({
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

  it("starts at step 1 when session is hydrated (guided walkthrough)", async () => {
    window.localStorage.setItem(
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
      expect(screen.getByText(/Step 1 of 6/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Active project:/i)).toHaveTextContent("Demo Project");
  });
});
