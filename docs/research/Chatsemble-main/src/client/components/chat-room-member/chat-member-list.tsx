import { ChatMemberBadge } from "@client/components/chat-room-member/chat-member-badge";
import { ChatMemberRemoveButton } from "@client/components/chat-room-member/chat-member-remove-button";
import { ChatMemberAddDialog } from "@client/components/chat-room-member/new/chat-member-add-dialog";
import { useOrganizationConnectionContext } from "@client/components/providers/organization-connection-provider";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@client/components/ui/avatar";
import { authClient } from "@client/lib/auth-client";
import type { ChatRoomMember } from "@shared/types";

interface ChatMemberListProps {
	members: ChatRoomMember[];
	showRemoveButton?: boolean;
}

export function ChatMemberList({
	members,
	showRemoveButton = false,
}: ChatMemberListProps) {
	const {
		mainChatRoomState: { room },
	} = useOrganizationConnectionContext();

	const { data: session, isPending: isSessionPending } =
		authClient.useSession();

	if (!members || members.length === 0) {
		return <ChatMemberListEmpty />;
	}

	return (
		<div className="w-full h-full overflow-y-auto border rounded-md p-2 flex flex-col gap-1">
			<ChatMemberAddDialog />
			{members.map((member: ChatRoomMember) => (
				<div
					key={member.id}
					className="flex items-center space-x-2 p-2 hover:bg-accent rounded-md"
				>
					<div className="flex items-center gap-2 flex-1">
						<Avatar className="h-6 w-6">
							<AvatarImage src={member.image ?? undefined} alt={member.name} />
							<AvatarFallback>
								{member.name[0]?.toUpperCase() ?? "?"}
							</AvatarFallback>
						</Avatar>
						<span className="text-sm font-medium">{member.name}</span>
						<ChatMemberBadge type={member.type} />
					</div>
					{showRemoveButton &&
						room &&
						!isSessionPending &&
						session?.user.id !== member.id && (
							<ChatMemberRemoveButton member={member} roomId={room.id} />
						)}
				</div>
			))}
		</div>
	);
}

function ChatMemberListEmpty() {
	return (
		<div className="p-4 text-sm text-muted-foreground text-center">
			No members in this chat room
		</div>
	);
}
