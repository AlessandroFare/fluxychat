import { Badge } from "@client/components/ui/badge";
import { cn } from "@client/lib/utils";
import type { ChatRoomMemberType } from "@shared/types";

interface ChatMemberBadgeProps {
	type: ChatRoomMemberType;
}

export function ChatMemberBadge({ type }: ChatMemberBadgeProps) {
	return (
		<Badge
			className={cn(
				type === "user"
					? "bg-blue-500 dark:bg-blue-900 dark:text-foreground"
					: "bg-purple-500 dark:bg-purple-900 dark:text-foreground",
			)}
		>
			{type === "user" ? "User" : "Agent"}
		</Badge>
	);
}
