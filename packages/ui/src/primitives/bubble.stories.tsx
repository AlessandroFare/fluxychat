import type { Meta, StoryObj } from "@storybook/react";
import { Bubble, BubbleContent } from "./bubble";

const meta: Meta<typeof Bubble> = {
  title: "Chat/Bubble",
  component: Bubble,
  tags: ["autodocs"],
};

export default meta;

type Story = StoryObj<typeof Bubble>;

export const Sent: Story = {
  render: () => (
    <Bubble variant="sent" align="end">
      <BubbleContent>Hello from FluxyChat — default theme.</BubbleContent>
    </Bubble>
  ),
};

export const Received: Story = {
  render: () => (
    <Bubble variant="received" align="start">
      <BubbleContent>Agent streaming reply with markdown support in full SDK.</BubbleContent>
    </Bubble>
  ),
};

export const Typing: Story = {
  render: () => (
    <Bubble variant="typing" align="start">
      <BubbleContent>Agent is typing…</BubbleContent>
    </Bubble>
  ),
};
