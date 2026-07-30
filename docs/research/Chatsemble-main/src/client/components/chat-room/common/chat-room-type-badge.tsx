import { Badge } from "@client/components/ui/badge";
import { cn } from "@client/lib/utils";
import type { ChatRoomType } from "@shared/types";

interface ChatRoomTypeBadgeProps {
	type: ChatRoomType;
	label?: string;
}

export function ChatRoomTypeBadge({ type, label }: ChatRoomTypeBadgeProps) {
	const labels: Record<ChatRoomType, string> = {
		public: "Public",
	};
	return (
		<Badge
			className={cn(
				type === "public"
					? "bg-blue-500 dark:bg-blue-900 dark:text-foreground"
					: "bg-purple-500 dark:bg-purple-900 dark:text-foreground",
			)}
		>
			{label ?? labels[type]}
		</Badge>
	);
}
