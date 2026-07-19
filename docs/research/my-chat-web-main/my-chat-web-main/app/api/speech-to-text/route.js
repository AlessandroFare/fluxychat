import * as utils from '@/app/api/utils/index'

import { getRequestContext } from '@cloudflare/next-on-pages'
import { speechToTextSchema } from './schema'

export const runtime = 'edge'

const defaultModel = '@cf/openai/whisper-large-v3-turbo'
const defaultLanguage = 'zh'
const defaultTask = 'transcribe'
const defaultPrompt = '以下音频内容主要为中文普通话，请优先输出简体中文转写结果。'

export async function POST(request) {
	const env = getRequestContext().env
	const body = await request.json()

	const [validObj, err] = utils.validReqSchema(speechToTextSchema, body)
	if (err) return err

	const response = await env.AI.run(validObj.model || defaultModel, {
		audio: validObj.audio,
		task: validObj.task || defaultTask,
		language: validObj.language || defaultLanguage,
		vad_filter: true,
		initial_prompt: defaultPrompt
	})

	return utils.returnJson({
		text: utils.extractResponseText(response),
		info: response.transcription_info || {},
		wordCount: response.word_count || 0,
		segments: response.segments || []
	})
}
