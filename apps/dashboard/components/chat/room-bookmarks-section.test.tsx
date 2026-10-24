import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RoomBookmarksSection } from "./room-bookmarks-section";
import {
  createRoomBookmark,
  deleteRoomBookmark,
  listRoomBookmarks,
} from "@/lib/room-bookmarks-client";

afterEach(cleanup);

vi.mock("@/lib/room-bookmarks-client", () => ({
  listRoomBookmarks: vi.fn(),
  createRoomBookmark: vi.fn(),
  deleteRoomBookmark: vi.fn(),
}));

const listMock = vi.mocked(listRoomBookmarks);
const createMock = vi.mocked(createRoomBookmark);
const deleteMock = vi.mocked(deleteRoomBookmark);

describe("RoomBookmarksSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listMock.mockResolvedValue([
      { id: "b1", label: "Runbook", url: "https://docs.test/runbook", position: 0 },
    ]);
    createMock.mockResolvedValue({
      id: "b2",
      label: "Status",
      url: "https://status.test",
      position: 1,
    });
    deleteMock.mockResolvedValue();
  });

  it("lists bookmarks and adds a new one", async () => {
    render(<RoomBookmarksSection roomId="room-1" token="jwt" />);

    await waitFor(() => {
      expect(screen.getByText("Runbook")).toBeInTheDocument();
    });
    expect(listMock).toHaveBeenCalledWith("jwt", "room-1");

    fireEvent.change(screen.getByTestId("bookmark-label-input"), {
      target: { value: "Status" },
    });
    fireEvent.change(screen.getByTestId("bookmark-url-input"), {
      target: { value: "https://status.test" },
    });
    listMock.mockResolvedValue([
      { id: "b1", label: "Runbook", url: "https://docs.test/runbook", position: 0 },
      { id: "b2", label: "Status", url: "https://status.test", position: 1 },
    ]);
    fireEvent.click(screen.getByRole("button", { name: /add bookmark/i }));

    await waitFor(() => {
      expect(createMock).toHaveBeenCalledWith("jwt", "room-1", {
        label: "Status",
        url: "https://status.test",
      });
    });
    await waitFor(() => {
      expect(screen.getByText("Status")).toBeInTheDocument();
    });
  });

  it("deletes a bookmark", async () => {
    render(<RoomBookmarksSection roomId="room-1" token="jwt" />);
    await waitFor(() => {
      expect(screen.getByText("Runbook")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /delete bookmark runbook/i }));
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith("jwt", "room-1", "b1");
    });
    expect(screen.queryByText("Runbook")).toBeNull();
  });
});
