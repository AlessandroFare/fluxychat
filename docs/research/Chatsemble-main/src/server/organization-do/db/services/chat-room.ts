import type { ChatRoom, ChatRoomMember } from "@shared/types";
import { eq } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { chatRoom, chatRoomMember } from "../schema";

export function createChatRoomService(db: DrizzleSqliteDODatabase) {
	return {
		/**
		 * Create a new chat room
		 * @param newChatRoom - The new chat room to create
		 * @param members - The members to add to the chat room
		 * @returns The created chat room
		 */
		async createChatRoom({
			newChatRoom,
			members,
		}: {
			newChatRoom: typeof chatRoom.$inferInsert;
			members: Omit<ChatRoomMember, "roomId">[];
		}) {
			// TODO: Transactions have some weird error
			const [createdChatRoom] = await db
				.insert(chatRoom)
				.values(newChatRoom)
				.returning();

			await db.insert(chatRoomMember).values(
				members.map((member) => ({
					...member,
					roomId: createdChatRoom.id,
				})),
			);

			return createdChatRoom;
		},

		/**
		 * Get a chat room by id
		 * @param id - The id of the chat room
		 * @returns The chat room
		 */
		async getChatRoomById(id: string): Promise<ChatRoom | undefined> {
			return await db.select().from(chatRoom).where(eq(chatRoom.id, id)).get();
		},

		/**
		 * Get all chat rooms
		 * @returns All chat rooms
		 */
		async getChatRoomsUserIsMemberOf(userId: string): Promise<ChatRoom[]> {
			return await db
				.select({
					id: chatRoom.id,
					name: chatRoom.name,
					type: chatRoom.type,
					organizationId: chatRoom.organizationId,
					createdAt: chatRoom.createdAt,
				})
				.from(chatRoomMember)
				.where(eq(chatRoomMember.id, userId))
				.innerJoin(chatRoom, eq(chatRoom.id, chatRoomMember.roomId));
		},
	};
}
