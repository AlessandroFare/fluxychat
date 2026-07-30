export const RouterEnum = {
	chat: '/chat',
	genImage: '/gen-image',
	translate: '/translate',
	speechToText: '/speech-to-text',
	history: '/history'
}

// 根据路由path 获取obj的key
export const mapPathToKey = (path) =>
	path === RouterEnum.chat
		? 'chat'
		: path === RouterEnum.genImage
		? 'img'
		: path === RouterEnum.translate
		? 'trans'
		: 'speech'

export const isValidRoute = (path) => {
	return Object.values(RouterEnum).includes(path)
}

export const aiToolList = [
	{
		id: 1,
		title: '聊天',
		desc: '使用最新的LLM大模型（如 LLaMA、Qwen等），提供出色的一对一聊天体验',
		url: RouterEnum.chat
	},
	{
		id: 2,
		title: '图片生成',
		desc: '输入一段文字描述，自动生成图片，模型使用stable-diffusion',
		url: RouterEnum.genImage
	},
	{
		id: 3,
		title: '文本翻译',
		desc: '输入一段文字，自动翻译为中文、英文、日文等',
		url: RouterEnum.translate
	},
	{
		id: 4,
		title: '语音转文字',
		desc: '上传音频文件，使用 Whisper 模型优先按中文转写为文本',
		url: RouterEnum.speechToText
	}
]
