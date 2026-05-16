import * as React from "react";
import { render, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MessageInput } from "./message-input";

const baseSuggestions = [
  { handle: "alice", label: "Alice" },
  { handle: "bob", label: "Bob" },
];

function StatefulMessageInput(
  props: Omit<
    React.ComponentProps<typeof MessageInput>,
    "value" | "onChange" | "editingValue" | "onEditingChange"
  > & { initialValue?: string }
) {
  const { initialValue = "", ...rest } = props;
  const [value, setValue] = React.useState(initialValue);
  const [editingValue, setEditingValue] = React.useState("");
  return (
    <MessageInput
      value={value}
      onChange={setValue}
      editingMessageId={null}
      editingValue={editingValue}
      onEditingChange={setEditingValue}
      replyToId={null}
      replyPreview={null}
      onCancelReply={vi.fn()}
      pendingAttachments={[]}
      onRemoveAttachment={vi.fn()}
      onAppendAttachments={vi.fn()}
      onSubmit={vi.fn()}
      {...rest}
    />
  );
}

describe("MessageInput", () => {
  it("opens mention list while typing @query and inserts handle on Enter", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StatefulMessageInput mentionSuggestions={baseSuggestions} />
    );
    const view = within(container);

    const input = view.getByPlaceholderText("Type a message…");
    await user.type(input, "@b");

    const list = await view.findByRole("listbox", { name: "Mention suggestions" });
    expect(within(list).getByRole("option", { name: /@bob/i })).toBeInTheDocument();
    expect(within(list).queryByRole("option", { name: /@alice/i })).not.toBeInTheDocument();

    await user.keyboard("{Enter}");

    await waitFor(() => {
      expect(input).toHaveValue("@bob ");
    });
  });

  it("inserts mention when clicking an option (mousedown)", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <StatefulMessageInput mentionSuggestions={baseSuggestions} />
    );
    const view = within(container);

    const input = view.getByPlaceholderText("Type a message…");
    await user.type(input, "@");

    const list = await view.findByRole("listbox");
    await user.click(within(list).getByRole("option", { name: /@alice/i }));

    await waitFor(() => {
      expect(input).toHaveValue("@alice ");
    });
  });

  it("matches mention by label substring (mentionMatchesQuery)", async () => {
    const user = userEvent.setup();
    const suggestions = [{ handle: "zzz", label: "Beta Corporation" }];
    const { container } = render(
      <StatefulMessageInput mentionSuggestions={suggestions} />
    );
    const view = within(container);

    const input = view.getByPlaceholderText("Type a message…");
    await user.type(input, "@bet");

    const list = await view.findByRole("listbox");
    expect(within(list).getByRole("option", { name: /@zzz/i })).toBeInTheDocument();

    await user.keyboard("{Enter}");
    await waitFor(() => {
      expect(input).toHaveValue("@zzz ");
    });
  });

  it("selects mention with ArrowDown navigation then Enter", async () => {
    const user = userEvent.setup();
    const three = [
      { handle: "alpha", label: "Alpha" },
      { handle: "beta", label: "Beta" },
      { handle: "gamma", label: "Gamma" },
    ];
    const { container } = render(
      <StatefulMessageInput mentionSuggestions={three} />
    );
    const view = within(container);

    const input = view.getByPlaceholderText("Type a message…");
    await user.type(input, "@");

    const list = await view.findByRole("listbox");
    expect(within(list).getAllByRole("option")).toHaveLength(3);

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    await waitFor(() => {
      expect(input).toHaveValue("@gamma ");
    });
  });

  it("with uploadComposerFile, image control opens file input with image accept", async () => {
    const uploadComposerFile = vi.fn().mockResolvedValue({
      kind: "image" as const,
      url: "https://cdn.example/x.png",
      name: "x.png",
    });
    const onAppend = vi.fn();

    const { container } = render(
      <StatefulMessageInput
        uploadComposerFile={uploadComposerFile}
        onAppendAttachments={onAppend}
      />
    );
    const view = within(container);

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, "click");

    await userEvent.click(
      view.getByRole("button", { name: "🖼️" })
    );

    expect(clickSpy).toHaveBeenCalled();
    expect(fileInput.accept).toContain("image/png");

    const file = new File([new Uint8Array([1, 2])], "shot.png", {
      type: "image/png",
    });
    await userEvent.upload(fileInput, file);

    await waitFor(() => {
      expect(uploadComposerFile).toHaveBeenCalledWith(file, "image");
      expect(onAppend).toHaveBeenCalledWith([
        { kind: "image", url: "https://cdn.example/x.png", name: "x.png" },
      ]);
    });
  });

  describe("without uploadComposerFile", () => {
    beforeEach(() => {
      vi.spyOn(window, "prompt").mockReturnValue("https://cdn.example/p.jpg");
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("image button appends attachment from prompt URL", async () => {
      const onAppend = vi.fn();
      const { container } = render(
        <StatefulMessageInput onAppendAttachments={onAppend} />
      );
      const view = within(container);

      await userEvent.click(view.getByTitle("Attach image URL"));

      expect(window.prompt).toHaveBeenCalledWith("Image URL");
      expect(onAppend).toHaveBeenCalledWith([
        expect.objectContaining({
          kind: "image",
          url: "https://cdn.example/p.jpg",
        }),
      ]);
    });
  });
});
