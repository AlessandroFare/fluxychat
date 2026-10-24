import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ops-client", () => ({
  opsListMcpServers: vi.fn(),
  opsRegisterMcpServer: vi.fn(),
  opsRefreshMcpServer: vi.fn(),
  opsReapproveMcpTool: vi.fn(),
  opsDeleteMcpServer: vi.fn(),
  opsTryMcpTool: vi.fn(),
}));

import {
  opsDeleteMcpServer,
  opsListMcpServers,
  opsReapproveMcpTool,
  opsRefreshMcpServer,
  opsRegisterMcpServer,
  opsTryMcpTool,
} from "@/lib/ops-client";
import { OpsMcpServersCard } from "./ops-mcp-servers-card";

const listMock = vi.mocked(opsListMcpServers);
const registerMock = vi.mocked(opsRegisterMcpServer);
const refreshMock = vi.mocked(opsRefreshMcpServer);
const reapproveMock = vi.mocked(opsReapproveMcpTool);
const deleteMock = vi.mocked(opsDeleteMcpServer);
const tryMock = vi.mocked(opsTryMcpTool);

function server(overrides: Record<string, unknown> = {}) {
  return {
    id: "omcp_1",
    name: "metrics",
    url: "https://mcp.example.com/mcp",
    enabled: true,
    hasSecret: true,
    allowedTools: [] as string[],
    discoveredTools: ["query", "restart"],
    ...overrides,
  };
}

describe("OpsMcpServersCard", () => {
  beforeEach(() => {
    listMock.mockResolvedValue({ servers: [] });
    registerMock.mockResolvedValue({ ok: true });
    refreshMock.mockResolvedValue({ ok: true });
    reapproveMock.mockResolvedValue({ ok: true });
    deleteMock.mockResolvedValue({ ok: true });
    tryMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("lists servers and marks calls denied until tools are allowed", async () => {
    listMock.mockResolvedValue({ servers: [server()] });
    render(<OpsMcpServersCard token="t" />);

    expect(await screen.findByText("metrics")).toBeInTheDocument();
    expect(screen.getByText(/none — mcp\.call is denied/)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /query/ })).not.toBeChecked();
  });

  it("labels an enterprise (ID-JAG) connection", async () => {
    listMock.mockResolvedValue({ servers: [server({ auth: "enterprise", hasSecret: false })] });
    render(<OpsMcpServersCard token="t" />);

    expect(await screen.findByText(/per-user enterprise sign-in \(ID-JAG\)/)).toBeInTheDocument();
  });

  it("registers a server with a secret, then saves the picked tools", async () => {
    listMock
      .mockResolvedValueOnce({ servers: [] })
      .mockResolvedValue({ servers: [server({ allowedTools: ["query"] })] });
    registerMock
      .mockResolvedValueOnce({
        ok: true,
        server: server(),
        discovery: {
          ok: true,
          tools: ["query", "restart"],
          catalog: [
            { name: "query", description: "run a query", readOnly: true },
            { name: "restart" },
          ],
        },
      })
      .mockResolvedValueOnce({ ok: true, server: server({ allowedTools: ["query"] }) });

    render(<OpsMcpServersCard token="t" />);
    await screen.findByText(/no mcp server registered/i);

    fireEvent.change(screen.getByPlaceholderText(/^name/i), { target: { value: "metrics" } });
    fireEvent.change(screen.getByPlaceholderText(/mcp\.example\.com/i), {
      target: { value: "https://mcp.example.com/mcp" },
    });
    fireEvent.change(screen.getByPlaceholderText(/bearer secret/i), { target: { value: "tok" } });
    fireEvent.click(screen.getByRole("button", { name: /register and discover/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith("t", {
        name: "metrics",
        url: "https://mcp.example.com/mcp",
        auth: "secret",
        secret: "tok",
        allowedTools: [],
      }),
    );
    fireEvent.click(await screen.findByRole("checkbox", { name: /query/ }));
    fireEvent.click(screen.getByRole("button", { name: /save allowed tools/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenLastCalledWith("t", {
        name: "metrics",
        url: "https://mcp.example.com/mcp",
        allowedTools: ["query"],
      }),
    );
  });

  it("registers a per-user OAuth server with the optional client fields", async () => {
    render(<OpsMcpServersCard token="t" />);
    await screen.findByText(/no mcp server registered/i);

    fireEvent.change(screen.getByPlaceholderText(/^name/i), { target: { value: "grafana" } });
    fireEvent.change(screen.getByPlaceholderText(/mcp\.example\.com/i), {
      target: { value: "https://mcp.example.com/mcp" },
    });
    fireEvent.change(screen.getByLabelText(/authentication/i), { target: { value: "oauth" } });
    fireEvent.change(screen.getByPlaceholderText(/oauth client id/i), { target: { value: "client-1" } });
    fireEvent.change(screen.getByPlaceholderText(/^scopes/i), { target: { value: "read write" } });
    fireEvent.click(screen.getByRole("button", { name: /register oauth server/i }));

    await waitFor(() =>
      expect(registerMock).toHaveBeenCalledWith("t", {
        name: "grafana",
        url: "https://mcp.example.com/mcp",
        auth: "oauth",
        oauthClientId: "client-1",
        oauthScopes: "read write",
        allowedTools: [],
      }),
    );
  });

  it("refreshes discovery and deletes a server", async () => {
    listMock.mockResolvedValue({ servers: [server()] });
    refreshMock.mockResolvedValue({
      ok: true,
      server: server({ discoveredTools: ["query"] }),
      discovery: { ok: true, tools: ["query"] },
    });

    render(<OpsMcpServersCard token="t" />);
    await screen.findByText("metrics");

    fireEvent.click(screen.getByRole("button", { name: /refresh tools/i }));
    await waitFor(() => expect(refreshMock).toHaveBeenCalledWith("t", "omcp_1"));
    await screen.findByText(/discovered 1 tool\(s\) on metrics/i);

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => expect(deleteMock).toHaveBeenCalledWith("t", "omcp_1"));
    await screen.findByText(/removed metrics/i);
  });

  it("shows a drift badge and re-approves the changed tool", async () => {
    listMock.mockResolvedValue({
      servers: [
        server({
          allowedTools: ["query"],
          toolsCatalog: [
            { name: "query", description: "v2", readOnly: true, changed: true, approvedAt: "2026-10-01T00:00:00.000Z" },
            { name: "restart", changed: false },
          ],
        }),
      ],
    });
    reapproveMock.mockResolvedValue({
      ok: true,
      server: server({
        allowedTools: ["query"],
        toolsCatalog: [{ name: "query", description: "v2", readOnly: true, changed: false }],
      }),
    });

    render(<OpsMcpServersCard token="t" />);
    await screen.findByText("metrics");
    expect(await screen.findByText(/definition changed — calls blocked/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /re-approve/i }));
    await waitFor(() => expect(reapproveMock).toHaveBeenCalledWith("t", "omcp_1", "query"));
    await screen.findByText(/re-approved query on metrics/i);
    expect(screen.queryByText(/definition changed — calls blocked/i)).not.toBeInTheDocument();
  });

  it("tries a pinned read-only tool from its schema and sends the edited args", async () => {
    listMock.mockResolvedValue({
      servers: [
        server({
          allowedTools: ["query"],
          toolsCatalog: [
            {
              name: "query",
              description: "run a query",
              readOnly: true,
              changed: false,
              inputSchema: { type: "object", properties: { q: { type: "string" } }, required: ["q"] },
            },
            { name: "restart", changed: false },
          ],
        }),
      ],
    });
    tryMock.mockResolvedValue({ ok: true, server: "metrics", tool: "query", content: "42 pods" });

    render(<OpsMcpServersCard token="t" />);
    await screen.findByText("metrics");

    fireEvent.click(screen.getByRole("button", { name: /^try$/i }));
    const argsBox = await screen.findByLabelText(/tool arguments/i);
    expect(argsBox).toHaveValue('{\n  "q": ""\n}');

    fireEvent.change(argsBox, { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await screen.findByText(/valid json/i);
    expect(tryMock).not.toHaveBeenCalled();

    fireEvent.change(argsBox, { target: { value: '{"q":"pods"}' } });
    fireEvent.click(screen.getByRole("button", { name: /^run$/i }));
    await waitFor(() => expect(tryMock).toHaveBeenCalledWith("t", "omcp_1", "query", { q: "pods" }));
    await screen.findByText(/42 pods/);
  });

  it("asks for a token when signed out", () => {
    render(<OpsMcpServersCard token="" />);
    expect(screen.getByText(/sign in with a project token/i)).toBeInTheDocument();
  });
});
