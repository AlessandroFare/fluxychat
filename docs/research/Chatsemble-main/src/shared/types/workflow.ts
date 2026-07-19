import { z } from "zod";
import type { ChatRoomMember } from "./chat";
import type { Versioned } from "./helper";

export const workflowStepSchema = z.object({
	stepId: z.string().describe("Unique identifier within the workflow"),
	description: z
		.string()
		.describe(
			"Natural language instruction for this step (guides AI or tool execution)",
		),
	toolName: z
		.string()
		.nullable()
		.describe(
			"Name of the specific tool to prioritize for this step (e.g., 'webSearch', 'deepResearch'). Null if AI should use internal capabilities or decide based on description.",
		),
	inputFromSteps: z
		.array(z.string())
		.optional()
		.describe(
			"Optional: Array of stepIds whose outputs should be considered as input for this step",
		),
});

type WorkflowStep = z.infer<typeof workflowStepSchema>;

export interface WorkflowSteps
	extends Versioned<WorkflowStep[], "workflowSteps", 1> {}

export interface WorkflowPartial {
	id: string;
	agentId: string;
	chatRoomId: string;
	goal: string;
	steps: WorkflowSteps;
	isRecurring: boolean;
	scheduleExpression: string;
	nextExecutionTime: number;
	lastExecutionTime: number | null;
	isActive: boolean;
	createdAt: number;
	updatedAt: number;
}

export interface Workflow extends WorkflowPartial {
	agent: ChatRoomMember;
}
