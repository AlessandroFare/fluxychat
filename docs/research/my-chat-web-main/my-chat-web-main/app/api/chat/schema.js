import { z } from 'zod'

export const chatMessageSchema = z.object({
	role: z.string(),
	content: z.string(),
	reasoning: z.string().optional()
})

export const chatChunkSchema = z.object({
	content: z.string().optional(),
	reasoning: z.string().optional(),
	done: z.boolean().optional()
})

export const chatResponseSchema = z.object({
	content: z.string(),
	reasoning: z.string()
})

export const chatSchema = z.object({
	prompt: z
		.string()
		.min(1, { message: '请输入至少一个字符' })
		.max(1000, { message: '最多只支持1000个字符' }),
	model: z.string().optional()
})

export const chatPostSchema = z.object({
	messages: z.array(chatMessageSchema).min(1),
	model: z.string().optional()
})
