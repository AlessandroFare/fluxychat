import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ReplySuggestions, suggestCache } from "./reply-suggestions";

const mockSuggestReplies = vi.fn();

vi.mock("@fluxy-chat/sdk", () => ({
  useFluxyChatOptional: () => ({
    client: { suggestReplies: mockSuggestReplies },
  }),
}));

describe("ReplySuggestions", () => {
  beforeEach(() => {
    cleanup();
    mockSuggestReplies.mockReset();
    suggestCache.clear();
  });

  it("renders the Suggest replies button initially", () => {
    render(<ReplySuggestions roomId="room_1" onSelect={vi.fn()} />);
    expect(screen.getByTestId("suggest-btn")).toBeInTheDocument();
  });

  it("calls suggestReplies and shows suggestions on click", async () => {
    mockSuggestReplies.mockResolvedValue(["OK", "Got it", "Thanks"]);
    const onSelect = vi.fn();
    render(<ReplySuggestions roomId="room_1" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("suggest-btn"));
    await waitFor(() => {
      expect(screen.getByTestId("reply-suggestions")).toBeInTheDocument();
    });
    expect(screen.getByText("OK")).toBeInTheDocument();
    expect(screen.getByText("Got it")).toBeInTheDocument();
    expect(screen.getByText("Thanks")).toBeInTheDocument();
    expect(mockSuggestReplies).toHaveBeenCalledWith("room_1", undefined);
  });

  it("fills input when a suggestion is clicked", async () => {
    mockSuggestReplies.mockResolvedValue(["Hello"]);
    const onSelect = vi.fn();
    render(<ReplySuggestions roomId="room_1" onSelect={onSelect} />);
    fireEvent.click(screen.getByTestId("suggest-btn"));
    await waitFor(() => {
      expect(screen.getByText("Hello")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Hello"));
    expect(onSelect).toHaveBeenCalledWith("Hello");
  });

  it("shows error when suggestReplies fails", async () => {
    mockSuggestReplies.mockRejectedValue(new Error("Network error"));
    render(<ReplySuggestions roomId="room_1" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId("suggest-btn"));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Network error");
    });
  });

  it("shows no suggestions message when result is empty", async () => {
    mockSuggestReplies.mockResolvedValue([]);
    render(<ReplySuggestions roomId="room_1" onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId("suggest-btn"));
    await waitFor(() => {
      expect(screen.getByText(/no suggestions available/i)).toBeInTheDocument();
    });
  });

  it("passes parentId when provided", async () => {
    mockSuggestReplies.mockResolvedValue(["Yes"]);
    render(<ReplySuggestions roomId="room_1" parentId={42} onSelect={vi.fn()} />);
    fireEvent.click(screen.getByTestId("suggest-btn"));
    await waitFor(() => {
      expect(mockSuggestReplies).toHaveBeenCalledWith("room_1", 42);
    });
  });
});
