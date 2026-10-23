import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({
  opsListMcpServers: vi.fn(),
  opsListMcpConnections: vi.fn(),
  opsConnectMcpServer: vi.fn(),
  opsDisconnectMcpConnection: vi.fn(),
}));

import {
  opsConnectMcpServer,
  opsDisconnectMcpConnection,
  opsListMcpConnections,
  opsListMcpServers,
} from "@/lib/ops-client";
import { OpsMcpConnectionsCard } from "./ops-mcp-connections-card";

const listServersMock = vi.mocked(opsListMcpServers);
const listConnectionsMock = vi.mocked(opsListMcpConnections);
const connectMock = vi.mocked(opsConnectMcpServer);
const disconnectMock = vi.mocked(opsDisconnectMcpConnection);

function server(overrides: Record<string, unknown> = {}) {
  return {
    id: "omcp_1",
    name: "grafana",
    url: "https://mcp.example.com/mcp",
    enabled: true,
    auth: "oauth" as const,
    hasSecret: false,
    allowedTools: ["query"],
    discoveredTools: ["query"],
    ...overrides,
  };
}

describe("OpsMcpConnectionsCard", () => {
  beforeEach(() => {
    listServersMock.mockResolvedValue({ servers: [] });
    listConnectionsMock.mockResolvedValue({ items: [] });
    connectMock.mockResolvedValue({ ok: true });
    disconnectMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows the connection state and disconnects an account", async () => {
    listServersMock.mockResolvedValue({ servers: [server()] });
    listConnectionsMock.mockResolvedValue({
      items: [
        {
          id: "omcn_1",
          serverId: "omcp_1",
          serverName: "grafana",
          status: "active",
          scopes: "tools.read",
        },
      ],
    });

    render(<OpsMcpConnectionsCard token="t" />);
    expect(await screen.findByText("grafana")).toBeInTheDocument();
    expect(screen.getByText(/connected · tools\.read/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /disconnect/i }));
    await waitFor(() => expect(disconnectMock).toHaveBeenCalledWith("t", "omcn_1"));
    await screen.findByText(/disconnected grafana/i);
  });

  it("starts a connection and surfaces a discovery failure", async () => {
    listServersMock.mockResolvedValue({ servers: [server()] });
    connectMock.mockResolvedValue({
      ok: false,
      error: "oauth_discovery_failed",
      message: "No OAuth metadata found.",
    });

    render(<OpsMcpConnectionsCard token="t" />);
    await screen.findByText(/not connected/i);
    fireEvent.click(screen.getByRole("button", { name: /^connect$/i }));

    await waitFor(() => expect(connectMock).toHaveBeenCalledWith("t", "omcp_1"));
    expect(await screen.findByText(/no oauth metadata found/i)).toBeInTheDocument();
  });

  it("ignores bearer-secret servers", async () => {
    listServersMock.mockResolvedValue({ servers: [server({ id: "omcp_2", name: "bearer", auth: "secret", hasSecret: true })] });
    render(<OpsMcpConnectionsCard token="t" />);
    expect(await screen.findByText(/no per-user oauth mcp server registered/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^connect$/i })).toBeNull();
  });

  it("asks for a token when signed out", () => {
    render(<OpsMcpConnectionsCard token="" />);
    expect(screen.getByText(/sign in with a project token/i)).toBeInTheDocument();
  });
});
