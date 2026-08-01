export { MarkdownBody } from "./markdown-body";
export type { MarkdownBodyProps } from "./markdown-body";
export { AgentMessage } from "./agent-message";
export type { AgentMessageProps } from "./agent-message";
export { AgentTypingIndicator } from "./agent-typing-indicator";
export type { AgentTypingIndicatorProps } from "./agent-typing-indicator";
export { ChannelList } from "./channel-list";
export type { ChannelListProps, ChannelListRoom } from "./channel-list";
export { ChatWindow } from "./chat-window";
export type { ChatWindowProps, MentionSuggestionItem } from "./chat-window";
export { MessageInput } from "./message-input";
export type { MessageInputProps, MentionSuggestion } from "./message-input";
export { getActiveMentionAtCursor, mentionMatchesQuery } from "./mention-utils";
export { MessageItem } from "./message-item";
export type { MessageItemProps } from "./message-item";
export { MessageList } from "./message-list";
export type { MessageListProps } from "./message-list";
export { ComposerToolsMenu } from "./composer-tools-menu";
export type { ComposerToolsMenuProps } from "./composer-tools-menu";
export {
  buildDeepResearchPrompt,
  buildWebSearchPrompt,
  buildImageGenerationCaption,
} from "./composer-prompts";
export type { ComposerToolPromptOptions } from "./composer-prompts";
export { resolveMediaUrl } from "./resolve-media-url";
export { PresenceList } from "./presence-list";
export type { PresenceListProps } from "./presence-list";
export { renderContentWithMentions } from "./render-content-with-mentions";
export { safeUrl } from "./safe-url";
export { TypingUsersIndicator } from "./typing-users-indicator";
export type { TypingUsersIndicatorProps } from "./typing-users-indicator";

// Primitives — consumers can import these directly if they need
// lower-level building blocks (e.g. for custom layouts).
export { cn } from "./lib/utils";
export {
  Message, MessageGroup, MessageAvatar, MessageContent, MessageHeader, MessageFooter,
  MessageTimestamp, MessageStatus, MessageActions, MessageHoverToolbar, MessageAction, MessageReactions,
  messageToolbarButtonClass, messageToolbarIconButtonClass,
} from "./primitives/message";
export {
  Bubble, BubbleGroup, BubbleContent, BubbleReactions,
  BubbleTitle, BubbleCaption, BubbleActions, BubbleTypingDots,
} from "./primitives/bubble";
export { Marker, MarkerIcon, MarkerContent, markerVariants } from "./primitives/marker";
export {
  Attachment, AttachmentGroup, AttachmentMedia, AttachmentContent,
  AttachmentTitle, AttachmentDescription, AttachmentActions, AttachmentAction, AttachmentTrigger,
} from "./primitives/attachment";
export {
  MessageScroller, MessageScrollerProvider, MessageScrollerViewport,
  MessageScrollerContent, MessageScrollerItem, MessageScrollerButton,
  MessageScrollerDate, MessageScrollerLoader, MessageScrollerUnreadCount,
  useMessageScroller, useMessageScrollerScrollable, useMessageScrollerVisibility,
} from "./primitives/message-scroller";
export { Button, buttonVariants } from "./primitives/button";
export {
  Composer, ComposerTextarea, ComposerToolbar, ComposerToolbarLeft,
  ComposerToolbarRight, ComposerIconButton, ComposerAttachmentPicker, ComposerSubmitButton,
} from "./primitives/composer";
export { ReactionPicker } from "./primitives/reaction-picker";
export type { ReactionPickerProps } from "./primitives/reaction-picker";
export { TypingIndicator } from "./primitives/typing-indicator";
export type { TypingIndicatorProps } from "./primitives/typing-indicator";
export {
  FLUXY_THEME_IDS,
  FLUXY_THEMES,
  applyFluxyTheme,
  fluxyThemeClassName,
  fluxyThemeStyle,
  getAllFluxyThemesCss,
  getFluxyThemeCss,
} from "./themes";
export type { FluxyThemeId, FluxyThemeTokens } from "./themes";
