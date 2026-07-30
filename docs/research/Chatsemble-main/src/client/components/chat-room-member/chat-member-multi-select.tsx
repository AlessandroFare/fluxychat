import { ChatMemberBadge } from "@client/components/chat-room-member/chat-member-badge";
import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@client/components/ui/avatar";
import { Checkbox } from "@client/components/ui/checkbox";
import { Skeleton } from "@client/components/ui/skeleton";
import { honoClient } from "@client/lib/api-client";
import type { ChatRoomMember, CreateChatRoomMember } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

type CreateChatRoomMemberWithoutRoomId = Omit<CreateChatRoomMember, "roomId">;

export function ChatMemberMultiSelect({
	selectedMembers,
	setSelectedMembers,
	limit,
}: {
	selectedMembers: CreateChatRoomMemberWithoutRoomId[];
	setSelectedMembers: (members: CreateChatRoomMemberWithoutRoomId[]) => void;
	limit?: number;
}) {
	const { data: users, isLoading: isLoadingUsers } = useQuery({
		queryKey: ["organization-users"],
		queryFn: async () => {
			const response = await honoClient.api.organization.users.$get({
				query: {
					includeUser: "false",
				},
			});
			return response.json();
		},
	});

	const { data: agents, isLoading: isLoadingAgents } = useQuery({
		queryKey: ["agents"],
		queryFn: async () => {
			const response = await honoClient.api.agents.$get();
			return response.json();
		},
	});

	const isLoading = isLoadingUsers || isLoadingAgents;

	// Combine users and agents with type information
	const allMembers: Omit<ChatRoomMember, "roomId">[] = useMemo(() => {
		const mappedUsers =
			users?.map((user) => ({
				id: user.id,
				name: user.name,
				type: "user" as const,
				role: "member" as const,
				image: user.image ?? "",
				email: user.email,
			})) || [];

		const mappedAgents =
			agents?.map((agent) => ({
				id: agent.id,
				name: agent.name,
				type: "agent" as const,
				role: "member" as const,
				image: agent.image ?? "",
				email: "",
			})) || [];

		return [...mappedUsers, ...mappedAgents];
	}, [users, agents]);

	if (isLoading) {
		return <ChatMemberMultiSelectSkeleton />;
	}

	const handleToggleMember = (
		chatRoomMember: CreateChatRoomMemberWithoutRoomId,
		checked: boolean,
	) => {
		const currentMembers = [...selectedMembers];

		if (checked) {
			// If we've reached the limit, don't add more members
			if (limit && currentMembers.length >= limit) {
				return;
			}

			// Add member if not already in the list
			if (!currentMembers.some((member) => member.id === chatRoomMember.id)) {
				currentMembers.push(chatRoomMember);
			}
		} else {
			// Remove member if in the list
			const index = currentMembers.findIndex(
				(member) => member.id === chatRoomMember.id,
			);
			if (index !== -1) {
				currentMembers.splice(index, 1);
			}
		}

		setSelectedMembers(currentMembers);
	};

	return (
		<div className="max-h-60 overflow-y-auto border rounded-md p-2">
			{allMembers.length > 0 ? (
				allMembers.map((item) => {
					const isSelected = selectedMembers.some(
						(member) => member.id === item.id && member.type === item.type,
					);

					// Disable selection if we've reached the limit
					const isDisabled =
						!!limit && selectedMembers.length >= limit && !isSelected;

					return (
						<div
							key={item.id}
							className={`flex items-center space-x-2 p-2 hover:bg-accent rounded-md ${isDisabled ? "opacity-50" : ""}`}
						>
							<Checkbox
								id={`member-${item.id}`}
								checked={isSelected}
								disabled={isDisabled}
								onCheckedChange={(checked) =>
									handleToggleMember(item, !!checked)
								}
							/>
							<label
								htmlFor={`member-${item.id}`}
								className={`flex items-center gap-2 flex-1 ${isDisabled ? "cursor-not-allowed" : "cursor-pointer"}`}
							>
								<Avatar className="h-6 w-6">
									<AvatarImage src={item.image ?? undefined} alt={item.name} />
									<AvatarFallback>
										{item.name[0]?.toUpperCase() ?? "?"}
									</AvatarFallback>
								</Avatar>
								<span>{item.name}</span>
								<ChatMemberBadge type={item.type} />
							</label>
						</div>
					);
				})
			) : (
				<ChatMemberMultiSelectNoMembers />
			)}
		</div>
	);
}

function ChatMemberMultiSelectSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-20" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

function ChatMemberMultiSelectNoMembers() {
	return (
		<div className="p-2 text-sm text-muted-foreground text-center">
			No members available
		</div>
	);
}
