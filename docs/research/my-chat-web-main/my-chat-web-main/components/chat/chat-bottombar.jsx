import { Button } from '@/components/ui/button'
import { ChatInput } from './chat-input'
import { Mic, Square } from 'lucide-react'
import { memo, useRef, useState } from 'react'
import { showToast } from '@/utils'
import { speechToTextWithApi } from '@/service'
import { useChat } from '@/hooks/useChat'

const ChatBottom = memo(({ type }) => {
	const { apiLoading, onInputChange, input, onSubmit } = useChat(type)
	const [recording, setRecording] = useState(false)
	const [speechLoading, setSpeechLoading] = useState(false)
	const mediaRecorderRef = useRef(null)
	const streamRef = useRef(null)
	const chunksRef = useRef([])

	const onKeyDown = (e) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			onSubmit()
		}
	}

	const stopTracks = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop())
			streamRef.current = null
		}
	}

	const blobToBase64 = (blob) =>
		new Promise((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => {
				const result = String(reader.result || '')
				const [, base64 = ''] = result.split(',')
				resolve(base64)
			}
			reader.onerror = reject
			reader.readAsDataURL(blob)
		})

	const transcribeAudio = async () => {
		const blob = new Blob(chunksRef.current, { type: mediaRecorderRef.current?.mimeType || 'audio/webm' })
		if (!blob.size) return

		setSpeechLoading(true)
		try {
			const audio = await blobToBase64(blob)
			const data = await speechToTextWithApi({
				audio,
				language: 'zh',
				task: 'transcribe'
			})
			const nextText = input ? `${input}\n${data.text}` : data.text
			onInputChange(nextText)
		} catch (error) {
			showToast(error.message || '语音转文字失败', 'error')
		} finally {
			setSpeechLoading(false)
		}
	}

	const startRecord = async () => {
		try {
			const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
			const recorder = new MediaRecorder(stream)
			chunksRef.current = []
			streamRef.current = stream
			mediaRecorderRef.current = recorder

			recorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					chunksRef.current.push(event.data)
				}
			}
			recorder.onstop = async () => {
				setRecording(false)
				stopTracks()
				await transcribeAudio()
			}

			recorder.start()
			setRecording(true)
		} catch (error) {
			showToast('无法访问麦克风，请检查浏览器权限', 'error')
		}
	}

	const stopRecord = () => {
		if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
			mediaRecorderRef.current.stop()
		}
	}

	return (
		<div className='sticky w-full h-18 flex items-center py-4 px-3 border-t'>
			<ChatInput
				placeholder='请输入内容'
				value={input}
				disabled={apiLoading || speechLoading}
				onChange={(e) => onInputChange(e.target.value)}
				onKeyDown={onKeyDown}
			/>
			<Button
				variant={recording ? 'destructive' : 'outline'}
				size='icon'
				disabled={apiLoading || speechLoading}
				className='ml-2 shrink-0'
				onClick={recording ? stopRecord : startRecord}
				title={recording ? '停止录音' : '开始录音'}
			>
				{recording ? <Square /> : <Mic />}
			</Button>
			<Button disabled={apiLoading || speechLoading} className='ml-2' onClick={() => onSubmit()}>
				发送
			</Button>
		</div>
	)
})

ChatBottom.displayName = 'ChatBottom'
export { ChatBottom }
