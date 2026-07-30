import {
	Avatar,
	AvatarFallback,
	AvatarImage,
} from "@client/components/ui/avatar";
import { Badge } from "@client/components/ui/badge";
import { Button } from "@client/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@client/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@client/components/ui/popover";
import { Skeleton } from "@client/components/ui/skeleton";
import { honoClient } from "@client/lib/api-client";
import { cn } from "@client/lib/utils";
import type { ChatRoomMember } from "@shared/types";
import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";
import { ChatMemberBadge } from "./chat-member-badge";

type PartialCreateChatRoomMember = {
	id: ChatRoomMember["id"];
	type: ChatRoomMember["type"];
};

interface ChatMemberComboboxProps {
	selectedMember: PartialCreateChatRoomMember | null;
	setSelectedMember: (member: PartialCreateChatRoomMember | null) => void;
	currentMembers?: ChatRoomMember[];
}

function ChatMemberComboboxSkeleton() {
	return (
		<div className="space-y-2">
			<Skeleton className="h-4 w-20" />
			<Skeleton className="h-10 w-full" />
		</div>
	);
}

type MemberOption = {
	id: string;
	name: string;
	image?: string | null;
	type: "user" | "agent";
	disabled?: boolean;
};

export function ChatMemberCombobox({
	currentMembers = [],
	selectedMember,
	setSelectedMember,
}: ChatMemberComboboxProps) {
	const [open, setOpen] = useState(false);

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

	if (isLoadingUsers || isLoadingAgents) {
		return <ChatMemberComboboxSkeleton />;
	}

	const userOptions: MemberOption[] =
		users?.map((user) => ({
			id: user.id,
			name: user.name,
			image: user.image,
			type: "user",
			disabled: currentMembers.some(
				(member) => member.id === user.id && member.type === "user",
			),
		})) || [];

	const agentOptions: MemberOption[] =
		agents?.map((agent) => ({
			id: agent.id,
			name: agent.name,
			image: agent.image,
			type: "agent",
			disabled: currentMembers.some(
				(member) => member.id === agent.id && member.type === "agent",
			),
		})) || [];

	const selectedUser = userOptions.find(
		(user) => user.id === selectedMember?.id,
	);
	const selectedAgent = agentOptions.find(
		(agent) => agent.id === selectedMember?.id,
	);
	const selectedOption = selectedUser || selectedAgent;

	const renderSelectedContent = () => {
		if (!selectedOption) {
			return "Select member";
		}

		return (
			<div className="flex items-center gap-2">
				<Avatar className="h-6 w-6">
					<AvatarImage
						src={selectedOption.image ?? undefined}
						alt={selectedOption.name}
					/>
					<AvatarFallback>
						{selectedOption.name[0]?.toUpperCase() ?? "?"}
					</AvatarFallback>
				</Avatar>
				<span>{selectedOption.name}</span>
				<ChatMemberBadge type={selectedOption.type} />
			</div>
		);
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					aria-expanded={open}
					className={cn(
						"w-full justify-between",
						!selectedMember && "text-muted-foreground",
					)}
				>
					{selectedMember ? renderSelectedContent() : "Select member"}
					<ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
				</Button>
			</PopoverTrigger>
			<PopoverContent className="w-[300px] p-0">
				<Command>
					<CommandInput placeholder="Search member..." />
					<CommandList>
						<CommandEmpty>No member found.</CommandEmpty>

						{userOptions.length > 0 && (
							<CommandGroup heading="Users">
								{userOptions.map((user) => (
									<CommandItem
										key={`user-${user.id}`}
										value={`user-${user.id}-${user.name}`}
										onSelect={() => {
											if (!user.disabled) {
												setSelectedMember({
													id: user.id,
													type: "user",
												});
												setOpen(false);
											}
										}}
										disabled={user.disabled}
										className={cn(
											user.disabled && "opacity-50 cursor-not-allowed",
										)}
									>
										<div className="flex items-center gap-2 flex-1">
											<Avatar className="h-6 w-6">
												<AvatarImage
													src={user.image ?? undefined}
													alt={user.name}
												/>
												<AvatarFallback>
													{user.name[0]?.toUpperCase() ?? "?"}
												</AvatarFallback>
											</Avatar>
											<span>{user.name}</span>
											{user.disabled && (
												<Badge variant="outline" className="ml-auto">
													Already added
												</Badge>
											)}
										</div>
										<Check
											className={cn(
												"ml-auto h-4 w-4",
												selectedMember?.id === user.id &&
													selectedMember?.type === "user"
													? "opacity-100"
													: "opacity-0",
											)}
										/>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{agentOptions.length > 0 && (
							<>
								{userOptions.length > 0 && <CommandSeparator />}
								<CommandGroup heading="Agents">
									{agentOptions.map((agent) => (
										<CommandItem
											key={`agent-${agent.id}`}
											value={`agent-${agent.id}-${agent.name}`}
											onSelect={() => {
												if (!agent.disabled) {
													setSelectedMember({
														id: agent.id,
														type: "agent",
													});
													setOpen(false);
												}
											}}
											disabled={agent.disabled}
											className={cn(
												agent.disabled && "opacity-50 cursor-not-allowed",
											)}
										>
											<div className="flex items-center gap-2 flex-1">
												<Avatar className="h-6 w-6">
													<AvatarImage
														src={agent.image ?? undefined}
														alt={agent.name}
													/>
													<AvatarFallback>
														{agent.name[0]?.toUpperCase() ?? "?"}
													</AvatarFallback>
												</Avatar>
												<span>{agent.name}</span>
												{agent.disabled && (
													<Badge variant="outline" className="ml-auto">
														Already added
													</Badge>
												)}
											</div>
											<Check
												className={cn(
													"ml-auto h-4 w-4",
													selectedMember?.id === agent.id &&
														selectedMember?.type === "agent"
														? "opacity-100"
														: "opacity-0",
												)}
											/>
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
