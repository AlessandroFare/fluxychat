import type { ChatRoomMessage } from "@shared/types";

export function updateMessageList({
	messages,
	newMessage,
	addAsNew,
}: {
	messages: ChatRoomMessage[];
	newMessage: ChatRoomMessage;
	addAsNew?: boolean;
}): ChatRoomMessage[] {
	if (addAsNew) {
		return [...messages, newMessage];
	}

	const optimisticId = newMessage.metadata.optimisticData?.id;
	if (optimisticId) {
		const existingOptimisticIndex = messages.findIndex(
			(message) => message.id === optimisticId,
		);
		if (existingOptimisticIndex >= 0) {
			const updatedMessages = [...messages];
			updatedMessages[existingOptimisticIndex] = newMessage;
			return updatedMessages;
		}
	}

	const existingMessageIndex = messages.findIndex(
		(message) => message.id === newMessage.id,
	);
	if (existingMessageIndex >= 0) {
		const updatedMessages = [...messages];
		updatedMessages[existingMessageIndex] = newMessage;
		return updatedMessages;
	}

	return [...messages, newMessage];
}
