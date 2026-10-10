import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChannelList } from "./channel-list";

describe("ChannelList", () => {
  it("shows an empty prompt when there are no rooms", () => {
    const { getByTestId } = render(
      <ChannelList channels={[]} onSelect={vi.fn()} />,
    );
    expect(getByTestId("channel-list-empty")).toHaveTextContent("Select a room to start chatting");
  });

  it("includes occupancy on the room title", () => {
    const { getByTitle } = render(
      <ChannelList
        channels={[{ id: "general", name: "General", presenceMembers: 2, connections: 4 }]}
        onSelect={vi.fn()}
      />,
    );
    expect(getByTitle("General · 2 in chat · 2 watching")).toBeInTheDocument();
  });
});
