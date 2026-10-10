import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatRoomInfoCaption, RoomInfo } from "./room-info";

describe("RoomInfo", () => {
  it("formats occupancy like the Ably kit header", () => {
    expect(
      formatRoomInfoCaption({
        roomName: "general",
        presenceMembers: 2,
        connections: 4,
      }),
    ).toBe("general · 2 in chat · 2 watching");
  });

  it("renders the caption", () => {
    render(<RoomInfo roomName="lobby" occupancy={{ presenceMembers: 1, connections: 3 }} />);
    expect(screen.getByTestId("room-info").textContent).toBe("lobby · 1 in chat · 2 watching");
  });
});
