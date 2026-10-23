import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ForwardMessageDialog, type ForwardClient } from "./forward-message-dialog";

afterEach(cleanup);

function makeClient() {
  const listRooms = vi.fn().mockResolvedValue([
    { id: "room-1", name: "General", type: "public" },
    { id: "room-2", name: "Design", type: "group" },
    { id: "room-3", name: "Ops", type: "group" },
  ]);
  const forwardMessageRest = vi.fn().mockResolvedValue({ id: 42 });
  const client: ForwardClient = { listRooms, forwardMessageRest };
  return { client, listRooms, forwardMessageRest };
}

describe("ForwardMessageDialog", () => {
  it("lists other rooms (excluding the source) and forwards on click", async () => {
    const { client, forwardMessageRest } = makeClient();
    const onClose = vi.fn();
    const onForwarded = vi.fn();
    render(
      <ForwardMessageDialog
        open
        client={client}
        messageId={7}
        sourceRoomId="room-1"
        onClose={onClose}
        onForwarded={onForwarded}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("forward-room-list")).toBeInTheDocument();
    });
    expect(screen.queryByText("General")).toBeNull();

    fireEvent.change(screen.getByTestId("forward-room-filter"), {
      target: { value: "des" },
    });
    expect(screen.queryByText("Ops")).toBeNull();

    fireEvent.click(screen.getByText("Design"));
    await waitFor(() => {
      expect(forwardMessageRest).toHaveBeenCalledWith(7, "room-2");
    });
    expect(onForwarded).toHaveBeenCalledWith("room-2");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows the failure when the server denies the forward", async () => {
    const { client, forwardMessageRest } = makeClient();
    forwardMessageRest.mockRejectedValueOnce(new Error("forbidden_target_room"));
    render(
      <ForwardMessageDialog
        open
        client={client}
        messageId={7}
        sourceRoomId="room-1"
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Design")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Design"));
    await waitFor(() => {
      expect(screen.getByText(/forbidden_target_room/)).toBeInTheDocument();
    });
  });
});
