export function createChatMessage(data = {}) {
	return {
		role: data.role || '',
		content: data.content || '',
		reasoning: data.reasoning || '',
		pending: !!data.pending
	}
}

export function createChatChunk(data = {}) {
	return {
		content: data.content || '',
		reasoning: data.reasoning || '',
		done: !!data.done
	}
}

export function createChatResponse(data = {}) {
	return {
		content: data.content || '',
		reasoning: data.reasoning || ''
	}
}

export function normalizeChatMessage(message = {}) {
	const { done, ...rest } = message || {}
	return {
		...rest,
		...createChatMessage(rest),
		isImage: !!rest.isImage
	}
}

export function normalizeChatMessages(messages = []) {
	return messages.map((message) => normalizeChatMessage(message))
}

export function mergeChatMessage(base = {}, patch = {}) {
	const current = normalizeChatMessage(base)
	const isDone = !!patch.done
	const normalizedPatch = normalizeChatMessage(patch)

	return {
		...current,
		...normalizedPatch,
		content: current.content + (patch.content || ''),
		reasoning: current.reasoning + (patch.reasoning || ''),
		pending: !isDone
	}
}
