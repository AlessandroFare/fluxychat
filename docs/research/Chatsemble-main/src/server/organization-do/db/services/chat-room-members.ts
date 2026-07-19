import type { ChatRoomMember, ChatRoomMemberType } from "@shared/types";
import { and, eq } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { chatRoomMember } from "../schema";

export function createChatRoomMemberService(db: DrizzleSqliteDODatabase) {
	return {
		/**
		 * Get all members of a chat room
		 * @param roomId - The id of the chat room
		 * @returns All members of the chat room
		 */
		async getChatRoomMembers({
			roomId,
			type,
		}: {
			roomId: string;
			type?: ChatRoomMemberType;
		}): Promise<ChatRoomMember[]> {
			const query = db.select().from(chatRoomMember);

			const whereClauses = [eq(chatRoomMember.roomId, roomId)];

			if (type) {
				whereClauses.push(eq(chatRoomMember.type, type));
			}

			return await query.where(and(...whereClauses)).all();
		},

		/**
		 * Delete a member from a chat room
		 * @param roomId - The id of the chat room
		 * @param memberId - The id of the member to delete
		 */
		async deleteChatRoomMember({
			roomId,
			memberId,
		}: {
			roomId: string;
			memberId: string;
		}) {
			await db
				.delete(chatRoomMember)
				.where(
					and(
						eq(chatRoomMember.roomId, roomId),
						eq(chatRoomMember.id, memberId),
					),
				);
		},

		/**
		 * Add a member to a chat room
		 * @param newChatRoomMember - The member to add
		 */
		async addChatRoomMember(
			newChatRoomMember: typeof chatRoomMember.$inferInsert,
		) {
			return await db
				.insert(chatRoomMember)
				.values(newChatRoomMember)
				.returning()
				.get();
		},

		/**
		 * Check if a user is a member of a chat room
		 * @param roomId - The id of the chat room
		 * @param userId - The id of the user
		 * @returns true if the user is a member, false otherwise
		 */
		async isUserMemberOfRoom({
			roomId,
			userId,
		}: {
			roomId: string;
			userId: string;
		}): Promise<boolean> {
			const member = await db
				.select()
				.from(chatRoomMember)
				.where(
					and(eq(chatRoomMember.roomId, roomId), eq(chatRoomMember.id, userId)),
				)
				.limit(1);
			return !!member;
		},
	};
}
