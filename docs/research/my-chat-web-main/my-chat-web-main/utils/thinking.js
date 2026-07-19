import { createChatResponse } from './chat-payload'

function extractText(value) {
	if (!value) return ''
	if (typeof value === 'string') return value
	if (Array.isArray(value)) {
		return value.map((item) => extractText(item)).join('')
	}
	if (typeof value === 'object') {
		if (typeof value.text === 'string') return value.text
		if (typeof value.content === 'string') return value.content
		if (value.content) return extractText(value.content)
		if (value.reasoning) return extractText(value.reasoning)
	}
	return ''
}

export function getStreamChunkPayload(chunk) {
	if (!chunk || typeof chunk !== 'object') {
		return createChatResponse()
	}

	const choice = chunk.choices?.[0] || {}
	const delta = choice.delta || {}
	const message = choice.message || {}

	const reasoning = extractText(
		delta.reasoning_content ||
			delta.reasoning ||
			message.reasoning_content ||
			message.reasoning ||
			chunk.reasoning_content ||
			chunk.reasoning
	)

	const content = extractText(
		delta.content || message.content || chunk.response || chunk.content || chunk.text
	)

	return createChatResponse({ reasoning, content })
}

// openai 兼容格式 返回数据解析 包括 推理过程
export async function formatStreamResponse(stream, onCb) {
	for await (const chunk of stream) {
		const { reasoning, content } = getStreamChunkPayload(chunk)
		if (!reasoning && !content) continue
		onCb({ reasoning, content })
	}

	onCb({ done: true })
}
