import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FluxyChatSettingsProvider } from "@fluxy-chat/sdk";
import { ChatWindow } from "./chat-window";
import type { FluxyChatMessage } from "@fluxy-chat/sdk";

function msg(overrides: Partial<FluxyChatMessage> = {}): FluxyChatMessage {
  return {
    id: 1,
    roomId: "lobby",
    userId: "ada",
    content: "hello",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("ChatWindow Ably kit HOW", () => {
  it("hides own edit when ChatSettings disallow updates", () => {
    render(
      <FluxyChatSettingsProvider initialGlobalSettings={{ allowMessageUpdatesOwn: false }}>
        <ChatWindow
          roomName="lobby"
          messages={[msg()]}
          online={1}
          typingUsers={{}}
          localUserId="ada"
          onEditMessage={vi.fn()}
          onSend={vi.fn()}
        />
      </FluxyChatSettingsProvider>,
    );
    expect(screen.queryByText("edit")).toBeNull();
  });

  it("confirms before deleting", async () => {
    const onDeleteMessage = vi.fn();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <ChatWindow
        messages={[msg()]}
        online={1}
        typingUsers={{}}
        localUserId="ada"
        onDeleteMessage={onDeleteMessage}
        onSend={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByText("delete"));
    expect(confirm).toHaveBeenCalledWith("Delete this message?");
    expect(onDeleteMessage).not.toHaveBeenCalled();
    confirm.mockReturnValue(true);
    await userEvent.click(screen.getByText("delete"));
    expect(onDeleteMessage).toHaveBeenCalledWith(1);
    confirm.mockRestore();
  });

  it("shows a discontinuity banner and notifies onError", () => {
    const onDiscontinuity = vi.fn();
    render(
      <ChatWindow
        messages={[]}
        online={0}
        typingUsers={{}}
        discontinuity={new Error("history hole")}
        onError={{ discontinuity: onDiscontinuity }}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("chat-window-discontinuity")).toHaveTextContent("history hole");
    expect(onDiscontinuity).toHaveBeenCalledTimes(1);
  });

  it("shows an empty transcript prompt", () => {
    render(
      <ChatWindow messages={[]} online={0} typingUsers={{}} onSend={vi.fn()} />,
    );
    expect(screen.getByTestId("message-list-empty")).toHaveTextContent("No messages yet");
  });

  it("shows a connection banner while reconnecting", () => {
    render(
      <ChatWindow
        messages={[]}
        online={0}
        typingUsers={{}}
        connectionStatus="reconnecting"
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("chat-window-connection")).toHaveTextContent(/Reconnecting/);
  });

  it("renders room reaction bursts and sends 👏", async () => {
    const onSendRoomReaction = vi.fn();
    render(
      <ChatWindow
        messages={[]}
        online={0}
        typingUsers={{}}
        roomReactions={[{ name: "🔥", userId: "bob" }]}
        onSendRoomReaction={onSendRoomReaction}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("room-reaction-bursts")).toHaveTextContent("🔥");
    await userEvent.click(screen.getByRole("button", { name: "Send room reaction" }));
    expect(onSendRoomReaction).toHaveBeenCalledWith("👏");
  });

  it("renders Stream unread separator before firstUnreadMessageId", () => {
    render(
      <ChatWindow
        messages={[
          msg({ id: 1, content: "old" }),
          msg({ id: 2, content: "new", createdAt: "2026-01-01T00:01:00.000Z" }),
        ]}
        online={1}
        typingUsers={{}}
        firstUnreadMessageId={2}
        onSend={vi.fn()}
      />,
    );
    expect(screen.getByTestId("unread-separator")).toHaveTextContent("New messages");
  });

  it("quotes without starting a reply thread", async () => {
    const onSend = vi.fn();
    render(
      <ChatWindow
        messages={[msg({ id: 1, content: "source" })]}
        online={1}
        typingUsers={{}}
        onSend={onSend}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Quote message" }));
    expect(screen.getByTestId("composer-quote-chip")).toHaveTextContent("Quoting #1");
    await userEvent.type(screen.getByRole("textbox"), "cited");
    await userEvent.keyboard("{Enter}");
    expect(onSend).toHaveBeenCalledWith("cited", null, [], { quotedMessageId: 1 });
  });
});
