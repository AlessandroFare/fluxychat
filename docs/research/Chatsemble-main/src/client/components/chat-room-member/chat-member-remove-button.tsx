"use client";

import { Button } from "@client/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@client/components/ui/dialog";
import { honoClient } from "@client/lib/api-client";
import type { ChatRoomMember } from "@shared/types";
import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState } from "react";

interface ChatMemberRemoveButtonProps {
	member: ChatRoomMember;
	roomId: string;
}

export function ChatMemberRemoveButton({
	member,
	roomId,
}: ChatMemberRemoveButtonProps) {
	const [open, setOpen] = useState(false);

	const removeMemberMutation = useMutation({
		mutationFn: async () => {
			const response = await honoClient.api.chat["chat-rooms"][
				":chatRoomId"
			].members[":memberId"].$delete({
				param: {
					chatRoomId: roomId,
					memberId: member.id,
				},
			});
			return response.json();
		},
		onSuccess: () => {
			setOpen(false);
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="h-7 w-7 text-muted-foreground hover:text-destructive"
				>
					<Trash2 className="h-4 w-4" />
					<span className="sr-only">Remove member</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>Remove Member</DialogTitle>
					<DialogDescription>
						Are you sure you want to remove {member.name} from this chat room?
					</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => setOpen(false)}>
						Cancel
					</Button>
					<Button
						variant="destructive"
						onClick={() => removeMemberMutation.mutate()}
						disabled={removeMemberMutation.isPending}
					>
						{removeMemberMutation.isPending ? "Removing..." : "Remove"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
