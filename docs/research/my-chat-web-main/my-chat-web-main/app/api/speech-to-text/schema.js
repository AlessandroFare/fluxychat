import { z } from 'zod'

export const speechToTextSchema = z.object({
	audio: z.string().min(1, { message: '请上传音频文件' }),
	model: z.string().optional(),
	language: z.string().optional(),
	task: z.enum(['transcribe', 'translate']).optional()
})
