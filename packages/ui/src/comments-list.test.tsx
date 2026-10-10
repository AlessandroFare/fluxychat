import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CommentsList } from "./comments-list";
import type { FluxyCommentThread } from "@fluxy-chat/sdk";

const thread: FluxyCommentThread = {
  id: "cth_1",
  roomId: "r1",
  createdBy: "ada",
  metadata: { x: 10, y: 20 },
  resolved: false,
  createdAt: "t0",
  updatedAt: "t0",
  comments: [
    { id: "c1", threadId: "cth_1", userId: "ada", body: "Pin me", createdAt: "t0" },
  ],
};

describe("CommentsList", () => {
  it("lists previews and hides resolved when filtered", () => {
    const { getByText, getByTestId, rerender } = render(
      <CommentsList threads={[thread]} onSelect={vi.fn()} />,
    );
    expect(getByText("Pin me")).toBeInTheDocument();
    rerender(
      <CommentsList
        threads={[{ ...thread, resolved: true }]}
        filter="open"
        onSelect={vi.fn()}
      />,
    );
    expect(getByTestId("comments-list-empty")).toBeInTheDocument();
  });
});
