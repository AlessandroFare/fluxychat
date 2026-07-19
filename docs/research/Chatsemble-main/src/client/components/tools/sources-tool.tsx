import { ScrollArea } from "@client/components/ui/scroll-area";
import { cn } from "@client/lib/utils";
import type { ToolSource } from "@shared/types";
import { Link2 } from "lucide-react";

export interface ToolInvocationSourceProps {
	source: ToolSource;
}

export function ToolInvocationSource({ source }: ToolInvocationSourceProps) {
	return (
		<a
			href={source.url}
			target="_blank"
			rel="noopener noreferrer"
			className="group/source flex items-start gap-2 py-1 hover:bg-muted/50 px-2 rounded-md transition-colors w-full overflow-hidden"
		>
			{source.icon ? (
				<img src={source.icon} alt="" className="h-4 w-4 mt-1 shrink-0" />
			) : (
				<Link2 className="h-4 w-4 mt-1 shrink-0 text-muted-foreground group-hover/source:text-foreground" />
			)}
			<div className="flex-1 overflow-hidden min-w-0">
				<div className="text-sm font-medium line-clamp-1 group-hover/source:underline">
					{source.title}
				</div>

				<div
					className={cn(
						"text-xs text-muted-foreground line-clamp-1 break-all",
						"group-hover/source:underline",
					)}
				>
					{source.url}
				</div>

				<div className="text-xs text-muted-foreground line-clamp-2">
					{source.content}
				</div>
			</div>
		</a>
	);
}

export interface ToolInvocationSourcesListProps {
	sources: ToolSource[];
	maxVisible?: number;
	maxHeight?: string;
}

export function ToolInvocationSourcesList({
	sources,
}: ToolInvocationSourcesListProps) {
	return (
		<div className="w-full overflow-y-auto flex flex-col gap-3 py-1">
			<div className="text-sm font-medium ml-2">Sources ({sources.length})</div>
			<ScrollArea className="h-full max-h-[10rem]">
				<div className="flex flex-col gap-1">
					{sources.map((source, index) => (
						<ToolInvocationSource
							key={`source-${source.url}-${index}`}
							source={source}
						/>
					))}
				</div>
			</ScrollArea>
		</div>
	);
}
