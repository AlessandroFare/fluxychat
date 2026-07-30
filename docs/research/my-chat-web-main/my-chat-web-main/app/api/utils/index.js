export * from './post'
export * from './validation'
export * from './models'
export { createChatChunk, createChatResponse } from '@/utils/chat-payload'

export function returnJson(data) {
	return Response.json({
		code: 200,
		message: 'success',
		data: data
	})
}

export function returnStreamText(stream) {
	return new Response(stream, {
		status: 200,
		statusText: 'ok',
		headers: { 'Content-Type': 'text/event-stream' }
	})
}

export function returnImage(response) {
	return new Response(response, { headers: { 'Content-Type': 'image/png' } })
}

export function returnJsonError(msg, data = {}) {
	return Response.json({
		code: 0,
		message: msg,
		data: data
	})
}

export function getQuery(req, key) {
	const url = new URL(req.url || req.request.url)
	return url.searchParams.get(key) || ''
}

function extractTextValue(value) {
	if (!value) return ''
	if (typeof value === 'string') return value
	if (Array.isArray(value)) {
		return value.map((item) => extractTextValue(item)).join('')
	}
	if (typeof value === 'object') {
		if (typeof value.text === 'string') return value.text
		if (typeof value.content === 'string') return value.content
		if (value.content) return extractTextValue(value.content)
		if (value.message) return extractTextValue(value.message)
		if (value.response) return extractTextValue(value.response)
	}
	return ''
}

export function extractResponseText(response) {
	if (!response || typeof response !== 'object') return ''

	return extractTextValue(
		response.text ||
			response.response ||
			response.translated_text ||
			response.content ||
			response.message ||
			response.choices?.[0]?.message ||
			response.choices?.[0]?.delta
	)
}

export function extractResponsePayload(response) {
	if (!response || typeof response !== 'object') {
		return createChatResponse()
	}

	const content = extractTextValue(
		response.text ||
			response.response ||
			response.translated_text ||
			response.content ||
			response.message ||
			response.choices?.[0]?.message?.content ||
			response.choices?.[0]?.delta?.content
	)

	const reasoning = extractTextValue(
		response.reasoning ||
			response.reasoning_content ||
			response.choices?.[0]?.message?.reasoning ||
			response.choices?.[0]?.message?.reasoning_content ||
			response.choices?.[0]?.delta?.reasoning ||
			response.choices?.[0]?.delta?.reasoning_content
	)

	return createChatResponse({ content, reasoning })
}
