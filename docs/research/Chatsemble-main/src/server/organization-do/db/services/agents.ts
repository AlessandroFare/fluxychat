import type { Agent } from "@shared/types";
import { eq, inArray } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { agent } from "../schema";

export function createAgentsService(db: DrizzleSqliteDODatabase) {
	return {
		/**
		 * Get all agents
		 * @returns All agents
		 */
		async getAgents(): Promise<Agent[]> {
			return await db.select().from(agent);
		},

		/**
		 * Create an agent
		 * @param agent - The agent to create
		 * @returns The created agent
		 */
		async createAgent(newAgent: typeof agent.$inferInsert): Promise<Agent> {
			const [createdAgent] = await db
				.insert(agent)
				.values(newAgent)
				.returning();
			return createdAgent;
		},

		/**
		 * Get an agent by ID
		 * @param id - The ID of the agent
		 * @returns The agent
		 */
		async getAgentById(id: string): Promise<Agent | undefined> {
			return await db.select().from(agent).where(eq(agent.id, id)).get();
		},

		/**
		 * Get agents by IDs
		 * @param ids - The IDs of the agents
		 * @returns The agents
		 */
		async getAgentsByIds(ids: string[]): Promise<Agent[]> {
			return await db.select().from(agent).where(inArray(agent.id, ids));
		},

		/**
		 * Update an agent
		 * @param id - The ID of the agent
		 * @param agent - The agent to update
		 * @returns The updated agent
		 */
		async updateAgent(
			id: string,
			agentUpdates: Partial<Omit<Agent, "id" | "createdAt">>,
		): Promise<Agent> {
			const [updatedAgent] = await db
				.update(agent)
				.set(agentUpdates)
				.where(eq(agent.id, id))
				.returning();
			return updatedAgent;
		},
	};
}
