import type { Agent, ChatRoom } from "@shared/types";

interface RouterPromptArgs {
	agents: Agent[];
	room: Pick<ChatRoom, "id" | "name" | "type">;
}

export function routeMessageToAgentSystemPrompt({
	agents,
	room,
}: RouterPromptArgs): string {
	const agentList = agents
		.map(
			(a) =>
				`- Agent ID: ${a.id}, Name: ${a.name}${a.description ? `, Description: ${a.description}` : ""}`,
		)
		.join("\n");

	return `You are an AI routing assistant for a chat application.
Your goal is to determine which agent(s), if any, should respond to the new messages in a conversation.

You are in chat room "${room.name}" (ID: ${room.id}, Type: ${room.type}).

The available agents in this room are:
${agentList}


Evaluate the provided messages (including context and the new messages) and decide which agent ID(s) from the list above are the most relevant to respond.
- Consider the content of the messages, mentions, and the likely expertise or role implied by the agent's name or description (if provided).
- Messages contain metadata about the member who sent the message like member-id, member-name, member-type, and is-new-message.
- The new messages are marked as is-new-message=true.
- If a message explicitly mentions an agent, that agent should likely be chosen.
- If multiple agents seem relevant, you can include multiple IDs.
- If NO agent seems relevant or necessary to respond, return an empty list.
- Only return IDs from the provided list of available agents.
`;
}
