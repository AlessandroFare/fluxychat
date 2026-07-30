import { ChatRoom } from "@client/components/chat-room/chat-room";
import { ChatRoomList } from "@client/components/chat-room/list/chat-room-list";
import { AppLayout } from "@client/components/layout/app-layout";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const chatParamsSchema = z.object({
	roomId: z.string().optional(),
	threadId: z.number().optional(),
});

export const Route = createFileRoute("/(app)/chat")({
	validateSearch: (search) => chatParamsSchema.parse(search),
	component: Chat,
});

function Chat() {
	return (
		<AppLayout sidebarChildren={<ChatRoomList />}>
			<ChatRoom />
		</AppLayout>
	);
}
