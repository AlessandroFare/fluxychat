import type { Agent } from "@shared/types";
import {
	getAssistantPersonaPrompt,
	getChatRoomContextPrompt,
	getCoreAssistantInstructionsPrompt,
	getResponseFormattingRulesPrompt,
	getStandardToolUsageRulesPrompt,
} from "./prompt-parts";

export function getDefaultAgentSystemPrompt({
	agentConfig,
	chatRoomId,
	threadId,
}: {
	agentConfig: Agent;
	chatRoomId: string;
	threadId: number | null;
}): string {
	const coreContext = getCoreAssistantInstructionsPrompt();
	const persona = getAssistantPersonaPrompt(agentConfig);
	const responseRules = getResponseFormattingRulesPrompt();
	const toolRules = getStandardToolUsageRulesPrompt();
	const chatRoomContext = getChatRoomContextPrompt(chatRoomId, threadId);

	return `
${coreContext}

${persona}

${responseRules}

${toolRules}

${chatRoomContext}
`.trim();
}
