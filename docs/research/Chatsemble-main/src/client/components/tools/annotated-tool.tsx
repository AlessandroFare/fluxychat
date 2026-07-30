import {
	Collapsible,
	CollapsibleContent,
} from "@client/components/ui/collapsible";
import { ScrollArea } from "@client/components/ui/scroll-area";
import { Separator } from "@client/components/ui/separator";
import {
	ToolInvocation,
	ToolInvocationContent,
	ToolInvocationHeader,
	ToolInvocationName,
} from "@client/components/ui/tool-invocation";
import { cn } from "@client/lib/utils";
import type {
	AgentToolAnnotation,
	AgentToolCall,
	AgentToolResult,
	AgentToolUse,
} from "@shared/types";
import { useState } from "react";

interface AnnotatedToolProps {
	toolUse: AgentToolUse;
	titleCall: string;
	titleResult: string;
}

export function AnnotatedTool({
	toolUse,
	titleCall,
	titleResult,
}: AnnotatedToolProps) {
	if (toolUse.type === "tool-call") {
		return <AnnotatedToolCall toolUse={toolUse} titleCall={titleCall} />;
	}
	return <AnnotatedToolResult toolUse={toolUse} titleResult={titleResult} />;
}

interface AnnotatedToolResultProps {
	toolUse: AgentToolResult;
	titleResult: string;
}

function AnnotatedToolResult({
	toolUse,
	titleResult,
}: AnnotatedToolResultProps) {
	const [historyOpen, setHistoryOpen] = useState(false);
	const sortedAnnotations = [...toolUse.annotations].sort(
		(a, b) => a.timestamp - b.timestamp,
	);
	return (
		<Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
			<ToolInvocation>
				<button
					type="button"
					onClick={() => setHistoryOpen(!historyOpen)}
					className="w-full cursor-pointer"
				>
					<ToolInvocationHeader>
						<ToolInvocationName name={titleResult} type="tool-result" />

						<span className="text-sm text-muted-foreground text-start">
							{historyOpen ? "Collapse" : "Expand to see more"}
						</span>
					</ToolInvocationHeader>
				</button>
				<CollapsibleContent>
					<ToolInvocationContent className="px-0">
						<Separator />
						<ToolInvocationAnnotationsHistory annotations={sortedAnnotations} />
					</ToolInvocationContent>
				</CollapsibleContent>
			</ToolInvocation>
		</Collapsible>
	);
}

interface AnnotatedToolCallProps {
	toolUse: AgentToolCall;
	titleCall: string;
}

function AnnotatedToolCall({ toolUse, titleCall }: AnnotatedToolCallProps) {
	const [historyOpen, setHistoryOpen] = useState(false);
	const sortedAnnotations = [...toolUse.annotations].sort(
		(a, b) => a.timestamp - b.timestamp,
	);
	return (
		<Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
			<ToolInvocation>
				<button
					type="button"
					onClick={() => setHistoryOpen(!historyOpen)}
					className="w-full cursor-pointer"
				>
					<ToolInvocationHeader>
						<ToolInvocationName name={titleCall} type="tool-call" />

						{sortedAnnotations.length > 0 && (
							<>
								<ToolInvocationAnnotation
									annotation={sortedAnnotations[sortedAnnotations.length - 1]}
									className="gap-2"
									messageClassName="line-clamp-1 text-start"
								/>

								<span className="text-sm text-muted-foreground text-start">
									{historyOpen ? "Collapse" : "Expand to see more"}
								</span>
							</>
						)}
					</ToolInvocationHeader>
				</button>
				<CollapsibleContent>
					<ToolInvocationContent className="px-0">
						<Separator />
						<ToolInvocationAnnotationsHistory annotations={sortedAnnotations} />
					</ToolInvocationContent>
				</CollapsibleContent>
			</ToolInvocation>
		</Collapsible>
	);
}

const statusColorMap: Record<string, string> = {
	processing: "bg-blue-500",
	complete: "bg-green-500",
	failed: "bg-red-500",
	default: "bg-gray-500",
};

interface ToolInvocationAnnotationProps {
	annotation: AgentToolAnnotation;
	className?: string;
	messageClassName?: string;
}

function ToolInvocationAnnotation({
	annotation,
	className,
	messageClassName,
}: ToolInvocationAnnotationProps) {
	const status = annotation.status;
	const statusColor = statusColorMap[status] || statusColorMap.default;

	return (
		<div className={cn("flex items-start gap-3", className)}>
			<div
				className={cn("h-2 w-2 rounded-full shrink-0 mt-1.5", statusColor)}
			/>
			<div className={cn("text-sm", messageClassName)}>
				{annotation.message}
			</div>
		</div>
	);
}

interface ToolInvocationAnnotationsHistoryProps {
	annotations: AgentToolAnnotation[];
}

function ToolInvocationAnnotationsHistory({
	annotations,
}: ToolInvocationAnnotationsHistoryProps) {
	return (
		<ScrollArea
			className={cn("flex flex-col mt-3 overflow-y-auto max-h-[16rem]")}
		>
			<div className={cn("flex flex-col gap-3 px-5")}>
				{annotations.map((annotation) => (
					<ToolInvocationAnnotation
						key={annotation.id}
						annotation={annotation}
					/>
				))}
			</div>
		</ScrollArea>
	);
}
