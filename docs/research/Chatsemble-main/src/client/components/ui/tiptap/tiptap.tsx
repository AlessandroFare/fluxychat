"use client";

import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
	forwardRef,
	useCallback,
	useEffect,
	useImperativeHandle,
	useRef,
} from "react";
import { Markdown } from "tiptap-markdown";
import "./style.css";
import type { ChatInputValue, ChatRoomMember } from "@shared/types";
import { Extension } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import type { Editor, JSONContent } from "@tiptap/react";
import { getMentionSuggestion } from "./mention-config";
import { MentioPlugin } from "./metion-plugin";

export interface TiptapMentionItem {
	id: string;
	label: string;
}

function extractMentionsFromJSONContent(
	content: JSONContent[],
): ChatInputValue["mentions"] {
	let mentions: ChatInputValue["mentions"] = [];
	for (const item of content) {
		if (item.type === "mention") {
			mentions.push({
				id: item.attrs?.id,
				name: item.attrs?.label,
			});
		}
		if (item.content) {
			mentions = mentions.concat(extractMentionsFromJSONContent(item.content));
		}
	}
	return mentions;
}

const KeyboardShortcuts = Extension.create({
	addKeyboardShortcuts() {
		return {
			Enter: () => {
				if (this.options.onEnter) {
					this.options.onEnter();
					// TODO: Since we are hijacking enter then style changing no longer works when you change line with shift enter
				}
				return true;
			},
		};
	},
	addOptions() {
		return {
			onEnter: () => {},
		};
	},
});

export const Tiptap = forwardRef(
	(
		{
			members,
			onChange,
			disabled = false,
			onEnter, // New prop for Enter key submission
		}: {
			members: ChatRoomMember[];
			onChange: (output: ChatInputValue) => void;
			disabled?: boolean;
			onEnter?: () => void; // Callback for Enter keypress
		},
		ref,
	) => {
		const membersRef = useRef(members);

		// Update the ref whenever the members prop changes
		useEffect(() => {
			membersRef.current = members;
		}, [members]);

		const onUpdate = useCallback(
			(props: { editor: Editor; transaction: Transaction }) => {
				const markdown = props.editor.storage.markdown.getMarkdown();
				const json = props.editor.getJSON();

				if (!json.content) {
					return;
				}

				const mentions = json.content
					? extractMentionsFromJSONContent(json.content)
					: [];
				onChange({ content: markdown, mentions });
			},
			[onChange],
		);

		const editor = useEditor({
			extensions: [
				StarterKit,
				Markdown.configure({ html: true }),
				MentioPlugin.configure({
					HTMLAttributes: { class: "mention" },
					suggestion: getMentionSuggestion(membersRef),
				}),
				// Add the custom keyboard extension with onEnter prop
				KeyboardShortcuts.configure({
					onEnter,
				}),
				Placeholder.configure({
					placeholder: "Type a message...",
				}),
			],
			onUpdate,
			editable: !disabled,
			immediatelyRender: false,
		});

		// Expose the clear method via the ref
		useImperativeHandle(ref, () => ({
			clear: () => {
				editor?.commands.clearContent();
			},
			getValue: (): ChatInputValue => {
				if (!editor) {
					return { content: "", mentions: [] };
				}
				const markdown = editor.storage.markdown.getMarkdown();
				const json = editor.getJSON();
				const mentions = json.content
					? extractMentionsFromJSONContent(json.content)
					: [];
				return { content: markdown, mentions };
			},
		}));

		return <EditorContent editor={editor} className="w-full h-full" />;
	},
);

Tiptap.displayName = "Tiptap";
