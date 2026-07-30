import type { ChatRoomMember } from "@shared/types";
import { ReactRenderer } from "@tiptap/react";
import type { SuggestionProps } from "@tiptap/suggestion";
import tippy from "tippy.js";
import MentionList from "./mention-list";
import type { TiptapMentionItem } from "./tiptap";

export function getMentionSuggestion(
	membersRef: React.RefObject<ChatRoomMember[]>,
) {
	return {
		items: ({ query }: { query: string }) => {
			// Access the latest members from the ref, default to empty array if undefined
			const members = membersRef.current || [];
			return members
				.filter((item) =>
					item.name.toLowerCase().startsWith(query.toLowerCase()),
				)
				.slice(0, 5);
		},

		render: () => {
			let component: ReactRenderer;
			let popup: ReturnType<typeof tippy>;

			return {
				onStart: (props: SuggestionProps<TiptapMentionItem>) => {
					component = new ReactRenderer(MentionList, {
						props: {
							items: props.items,
							command: props.command,
						},
						editor: props.editor,
					});

					if (!props.clientRect) {
						return;
					}

					popup = tippy("body", {
						getReferenceClientRect: props.clientRect as () => DOMRect,
						appendTo: () => document.body,
						content: component.element,
						showOnCreate: true,
						interactive: true,
						trigger: "manual",
						placement: "bottom-start",
					});
				},

				onUpdate: (props: SuggestionProps<TiptapMentionItem>) => {
					component.updateProps(props);

					if (!props.clientRect) {
						return;
					}

					popup[0].setProps({
						// Type assertion due to potential Tippy.js type inaccuracies
						getReferenceClientRect: props.clientRect as () => DOMRect,
					});
				},

				onKeyDown: (props: { event: KeyboardEvent }) => {
					if (props.event.key === "Escape") {
						popup[0].hide();
						return true;
					}

					// @ts-expect-error
					return component.ref?.onKeyDown({ event: props.event }) || false;
				},

				onExit: () => {
					popup[0].destroy();
					component.destroy();
				},
			};
		},
	};
}
