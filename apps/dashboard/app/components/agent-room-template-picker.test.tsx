import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentRoomTemplatePicker } from "./agent-room-template-picker";

const listMessageTemplates = vi.fn().mockResolvedValue([
  {
    id: "tpl_1",
    projectId: "p1",
    name: "welcome",
    body: "Hello {{name}}",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
]);

vi.mock("@fluxy-chat/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@fluxy-chat/sdk")>();
  return {
    ...actual,
    FluxyChatClient: class MockFluxyChatClient {
      listMessageTemplates = listMessageTemplates;
    },
  };
});

describe("AgentRoomTemplatePicker", () => {
  it("loads templates and emits selection when vars are filled", async () => {
    const onChange = vi.fn();
    render(
      <AgentRoomTemplatePicker
        adminJwt="admin-token"
        value={null}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /use message template/i }));

    await waitFor(() => {
      expect(screen.getByTestId("agent-room-template-select")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByTestId("agent-room-template-select"), {
      target: { value: "tpl_1" },
    });

    fireEvent.change(screen.getByTestId("agent-room-template-var-name"), {
      target: { value: "Ada" },
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({
          templateId: "tpl_1",
          renderedPreview: "Hello Ada",
          vars: { name: "Ada" },
        }),
      );
    });

    expect(screen.getByTestId("agent-room-template-preview")).toHaveTextContent("Hello Ada");
  });
});
