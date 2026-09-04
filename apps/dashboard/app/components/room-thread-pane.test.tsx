import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoomThreadPane } from "./room-thread-pane";

const sendMessage = vi.fn();
const loadPrevious = vi.fn();

vi.mock("@fluxy-chat/react", () => ({
  useThread: () => ({
    messages: [
      {
        id: 12,
        roomId: "room_1",
        userId: "alice",
        content: "Nested reply",
        createdAt: "2026-09-04T00:00:00.000Z",
        parentId: 7,
      },
    ],
    sendMessage,
    loadPrevious,
    hasPrevious: false,
    isLoadingPrevious: false,
  }),
}));

describe("RoomThreadPane", () => {
  it("renders thread replies and sends with useThread", async () => {
    render(
      <RoomThreadPane roomId="room_1" threadParentId={7} onClose={() => undefined} />,
    );
    expect(screen.getByTestId("room-thread-pane")).toBeTruthy();
    expect(screen.getByText("Nested reply")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Reply in thread"), {
      target: { value: "ok" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(sendMessage).toHaveBeenCalledWith("ok");
  });
});
