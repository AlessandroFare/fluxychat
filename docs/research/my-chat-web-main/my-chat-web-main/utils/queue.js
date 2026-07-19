import { createChatChunk } from './chat-payload'

class TextQueue {
	constructor() {
		this.queue = []
		this.timer = null
		this.duration = [200, 300, 400, 600, 800] // 批量更新间隔
	}

	startQueue(cb) {
		this.reset() // 确保队列和计时器初始状态
		return (chunk) => {
			this.addText(chunk)
			if (chunk?.done) {
				this.flush(cb)
				return
			}
			this.runQueue(cb)
		}
	}

	reset() {
		this.queue = []
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}
	}

	addText(chunk) {
		this.queue.push(chunk)
	}

	isEmpty() {
		return this.queue.length === 0
	}

	flush(cb) {
		if (this.timer) {
			clearTimeout(this.timer)
			this.timer = null
		}
		if (!this.isEmpty()) {
			const chunk = this.mergeQueue()
			this.queue = []
			cb(chunk)
		}
	}

	mergeQueue() {
		return this.queue.reduce(
			(acc, item = {}) => ({
				content: acc.content + (item.content || ''),
				reasoning: acc.reasoning + (item.reasoning || ''),
				done: acc.done || !!item.done
			}),
			createChatChunk()
		)
	}

	runQueue(cb) {
		if (this.timer) return // 防止重复运行
		this.timer = setTimeout(() => {
			if (!this.isEmpty()) {
				const text = this.mergeQueue() // 合并所有队列内容
				this.queue = [] // 清空队列
				cb(text) // 执行回调
			}
			this.timer = null // 允许下一次运行
		}, this.getDuration())
	}

	getDuration() {
		return this.duration[Math.floor(Math.random() * this.duration.length)]
	}
}

const queue = new TextQueue()
export default queue
