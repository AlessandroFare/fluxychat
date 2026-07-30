import chatRoomRoutes from "@server/routes/protected/chat/chat-room";
import chatRoomMemberRoutes from "@server/routes/protected/chat/chat-room-members";
import type { HonoContext } from "@server/types/hono";
import { Hono } from "hono";

const app = new Hono<HonoContext>()
	.route("/chat-rooms", chatRoomRoutes)
	.route("/chat-rooms", chatRoomMemberRoutes);

export default app;
