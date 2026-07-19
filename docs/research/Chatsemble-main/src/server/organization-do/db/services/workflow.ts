import type { Workflow, WorkflowPartial, WorkflowSteps } from "@shared/types";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { agent, workflows } from "../schema";

export function createWorkflowService(db: DrizzleSqliteDODatabase) {
	return {
		async createAgentWorkflow({
			goal,
			steps,
			scheduleExpression,
			isRecurring,
			nextExecutionTime,
			chatRoomId,
			agentId,
		}: {
			goal: string;
			steps: WorkflowSteps;
			scheduleExpression: string;
			isRecurring: boolean;
			nextExecutionTime: number;
			agentId: string;
			chatRoomId: string;
		}): Promise<Workflow> {
			const [newWorkflow] = await db
				.insert(workflows)
				.values({
					goal,
					steps,
					chatRoomId,
					isActive: true,
					isRecurring,
					scheduleExpression,
					nextExecutionTime,
					agentId,
				})
				.returning();

			if (!newWorkflow) {
				throw new Error("Failed to create workflow");
			}

			const workflow = await this.getAgentWorkflowById(newWorkflow.id);

			return workflow;
		},

		async getAgentWorkflowById(id: string): Promise<Workflow> {
			const result = await db
				.select({
					workflow: workflows,
					agent: agent,
				})
				.from(workflows)
				.innerJoin(agent, eq(workflows.agentId, agent.id))
				.where(eq(workflows.id, id))
				.get();

			if (!result) {
				throw new Error("Workflow or Agent not found");
			}

			return {
				...result.workflow,
				agent: {
					id: result.agent.id,
					name: result.agent.name,
					email: result.agent.email,
					image: result.agent.image,
					role: "member",
					type: "agent",
					roomId: result.workflow.chatRoomId,
				},
			};
		},

		async getAgentWorkflows(agentId: string): Promise<Workflow[]> {
			const results = await db
				.select({ workflow: workflows, agent: agent })
				.from(workflows)
				.innerJoin(agent, eq(workflows.agentId, agent.id))
				.where(eq(workflows.agentId, agentId));

			return results.map((result) => ({
				...result.workflow,
				agent: {
					id: result.agent.id,
					name: result.agent.name,
					email: result.agent.email,
					image: result.agent.image,
					role: "member",
					type: "agent",
					roomId: result.workflow.chatRoomId,
				},
			}));
		},

		async getChatRoomWorkflows(chatRoomId: string): Promise<Workflow[]> {
			const workflowsObtained = await db
				.select({
					workflow: workflows,
					agent: agent,
				})
				.from(workflows)
				.innerJoin(agent, eq(workflows.agentId, agent.id))
				.where(eq(workflows.chatRoomId, chatRoomId));

			return workflowsObtained.map((workflow) => ({
				...workflow.workflow,
				agent: {
					id: workflow.agent.id,
					name: workflow.agent.name,
					email: workflow.agent.email,
					image: workflow.agent.image,
					role: "member",
					type: "agent",
					roomId: workflow.workflow.chatRoomId,
				},
			}));
		},

		async getDueWorkflows(now: number): Promise<WorkflowPartial[]> {
			const workflowsResult = await db
				.select()
				.from(workflows)
				.where(
					and(
						eq(workflows.isActive, true),
						lte(workflows.nextExecutionTime, now),
					),
				);

			return workflowsResult;
		},

		async findNextWorkflowTime(now: number): Promise<number | null> {
			const nextWorkflow = await db
				.select()
				.from(workflows)
				.where(
					and(
						eq(workflows.isActive, true),
						gte(workflows.nextExecutionTime, now),
					),
				)
				.orderBy(asc(workflows.nextExecutionTime))
				.get();

			return nextWorkflow?.nextExecutionTime ?? null;
		},

		async updateWorkflow(
			id: string,
			data: Partial<WorkflowPartial>,
		): Promise<void> {
			await db.update(workflows).set(data).where(eq(workflows.id, id));
		},

		async deleteWorkflow(id: string): Promise<WorkflowPartial> {
			const deletedWorkflow = await db
				.delete(workflows)
				.where(eq(workflows.id, id))
				.returning()
				.get();

			if (!deletedWorkflow) {
				throw new Error("Workflow not found");
			}

			return deletedWorkflow;
		},
	};
}
