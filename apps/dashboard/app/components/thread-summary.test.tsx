import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { ThreadSummary } from "./thread-summary";

const mockSummarizeThread = vi.fn();

vi.mock("@fluxy-chat/sdk", () => ({
  useFluxyChatOptional: () => ({
    summarizeThread: mockSummarizeThread,
  }),
}));

describe("ThreadSummary", () => {
  beforeEach(() => {
    cleanup();
    mockSummarizeThread.mockReset();
  });

  it("renders nothing when reply count is below threshold", () => {
    const { container } = render(
      <ThreadSummary roomId="room_1" messageId={1} replyCount={1} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("fetches and shows summary on click", async () => {
    mockSummarizeThread.mockResolvedValue({
      summary: "- Billing issue resolved\n- Receipt sent",
      rootMessageId: 1,
      messageCount: 3,
    });

    render(<ThreadSummary roomId="room_1" messageId={1} replyCount={3} />);
    fireEvent.click(screen.getByTestId("thread-summary-btn"));

    await waitFor(() => {
      expect(screen.getByTestId("thread-summary")).toBeInTheDocument();
    });
    expect(screen.getByText(/Billing issue resolved/)).toBeInTheDocument();
    expect(mockSummarizeThread).toHaveBeenCalledWith(1, "room_1");
  });

  it("shows error when summarize fails", async () => {
    mockSummarizeThread.mockRejectedValue(new Error("quota exceeded"));

    render(<ThreadSummary roomId="room_1" messageId={5} replyCount={4} />);
    fireEvent.click(screen.getByTestId("thread-summary-btn"));

    await waitFor(() => {
      expect(screen.getByText("quota exceeded")).toBeInTheDocument();
    });
  });
});
