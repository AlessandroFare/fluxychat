import type {
	ChatRoom,
	WsChatIncomingMessage,
	WsChatOutgoingMessage,
} from "@shared/types";
import { useCallback, useEffect, useState } from "react";
import type { UseWebSocketConnectionStatus } from "../use-web-socket";

export function useOrganizationState({
	sendMessage,
	connectionStatus,
}: {
	sendMessage: (message: WsChatIncomingMessage) => void;
	connectionStatus: UseWebSocketConnectionStatus;
}) {
	const [chatRooms, setChatRooms] = useState<ChatRoom[]>([]);
	const [status, setStatus] = useState<"loading" | "success" | "error">(
		"loading",
	);

	useEffect(() => {
		if (connectionStatus === "connected") {
			sendMessage({ type: "organization-init-request" });
		}
	}, [connectionStatus, sendMessage]);

	const handleMessage = useCallback((wsMessage: WsChatOutgoingMessage) => {
		switch (wsMessage.type) {
			case "organization-init-response":
				setChatRooms(wsMessage.chatRooms);
				setStatus("success");
				break;
			case "chat-rooms-update":
				setChatRooms(wsMessage.chatRooms);
				setStatus("success");
				break;
		}
	}, []);

	return {
		chatRooms,
		status,
		handleMessage,
	};
}
