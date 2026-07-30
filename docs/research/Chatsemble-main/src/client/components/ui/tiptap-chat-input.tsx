"use client";

import { Button } from "@client/components/ui/button";
import { Tiptap } from "@client/components/ui/tiptap/tiptap";
import { cn } from "@client/lib/utils";
import type { ChatInputValue, ChatRoomMember } from "@shared/types";
import { ArrowUpIcon } from "lucide-react";
import React, {
	createContext,
	forwardRef,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";

interface ChatInputContextValue {
	internalValue: ChatInputValue;
	setInternalValue: (value: ChatInputValue) => void;
	onSubmitInternal: () => void;
	disabled?: boolean;
	chatMembers: ChatRoomMember[];
}

const ChatInputContext = createContext<ChatInputContextValue>({
	internalValue: { content: "", mentions: [] },
	setInternalValue: () => {},
	onSubmitInternal: () => {},
	chatMembers: [],
});

interface ChatInputProps {
	children: React.ReactNode;
	className?: string;
	onSubmit: (value: ChatInputValue) => void;
	disabled?: boolean;
	chatMembers: ChatRoomMember[];
}

function ChatInput({
	children,
	className,
	onSubmit,
	chatMembers = [],
	disabled,
}: ChatInputProps) {
	const [internalValue, setInternalValue] = useState<ChatInputValue>({
		content: "",
		mentions: [],
	});
	const editorRef = useRef<{
		clear: () => void;
		getValue: () => ChatInputValue;
	}>(null);

	const onSubmitRef = useRef(onSubmit);

	useEffect(() => {
		onSubmitRef.current = onSubmit;
	}, [onSubmit]);

	const handleSubmitInternal = () => {
		if (editorRef.current) {
			const currentValue = editorRef.current.getValue();
			if (!currentValue.content.trim()) {
				return;
			}
			onSubmitRef.current(currentValue);
			editorRef.current.clear();
		}
	};

	const contextValue: ChatInputContextValue = {
		internalValue,
		setInternalValue,
		onSubmitInternal: handleSubmitInternal,
		chatMembers,
		disabled,
	};

	return (
		<ChatInputContext.Provider value={contextValue}>
			<div
				className={cn(
					"flex flex-col items-end w-full p-2 rounded-2xl border border-input bg-background focus-within:ring-1 focus-within:ring-ring focus-within:outline-none",
					className,
				)}
			>
				{React.Children.map(children, (child) => {
					if (React.isValidElement(child)) {
						if (child.type === ChatInputTiptap) {
							return React.cloneElement(child, {
								ref: editorRef,
								//@ts-expect-error
								...child.props,
							});
						}
						return child;
					}
					return child;
				})}
			</div>
		</ChatInputContext.Provider>
	);
}

ChatInput.displayName = "ChatInput";

const ChatInputTiptap = forwardRef((_, ref) => {
	const context = useContext(ChatInputContext);
	const members = context.chatMembers ?? [];
	const setInternalValue = context.setInternalValue;
	const onSubmitInternal = context.onSubmitInternal;
	//const disabled = disabledProp ?? context.disabled;

	return (
		<Tiptap
			ref={ref}
			members={members}
			onChange={setInternalValue}
			//disabled={disabled}
			onEnter={onSubmitInternal}
		/>
	);
});

ChatInputTiptap.displayName = "ChatInputTiptap";

function ChatInputSubmit({
	className,
	...props
}: React.ComponentProps<typeof Button>) {
	const context = useContext(ChatInputContext);
	const onSubmitInternal = context.onSubmitInternal;
	const disabled = context.disabled;
	const internalValue = context.internalValue;

	const isDisabled = disabled || !internalValue;
	internalValue?.content.trim().length === 0;

	return (
		<Button
			size="icon"
			className={cn(
				"shrink-0 rounded-full border dark:border-zinc-600",
				className,
			)}
			disabled={isDisabled}
			onClick={(event) => {
				event.preventDefault();
				if (!isDisabled) {
					onSubmitInternal();
				}
			}}
			{...props}
		>
			<ArrowUpIcon />
		</Button>
	);
}

ChatInputSubmit.displayName = "ChatInputSubmit";

export { ChatInput, ChatInputTiptap, ChatInputSubmit };
