import { ChatMemberList } from "@client/components/chat-room-member/chat-member-list";
import { useOrganizationConnectionContext } from "@client/components/providers/organization-connection-provider";

export function ChatDetailsMembersSection() {
	const {
		mainChatRoomState: { members },
	} = useOrganizationConnectionContext();

	// TODO: Show or hide the add and remove member button based on the user's permissions

	return <ChatMemberList members={members} showRemoveButton={true} />;
}
