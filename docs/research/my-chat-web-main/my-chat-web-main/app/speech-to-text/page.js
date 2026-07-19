'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Mic, Square } from 'lucide-react'
import { showToast } from '@/utils'
import { speechToTextWithApi } from '@/service'
import { useCurrentModel, useInitModel } from '@/hooks/useModel'
import { useSidebarClose } from '@/hooks/useSidebarClose'
import { useRef, useState } from 'react'

function fileToBase64(file) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()
		reader.onload = () => {
			const result = String(reader.result || '')
			const [, base64 = ''] = result.split(',')
			resolve(base64)
		}
		reader.onerror = reject
		reader.readAsDataURL(file)
	})
}

function formatDuration(duration) {
	if (duration == null || Number.isNaN(Number(duration))) return '--'

	const totalSeconds = Math.max(0, Math.round(Number(duration)))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	if (hours > 0) {
		return [hours, minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
	}

	return [minutes, seconds].map((item) => String(item).padStart(2, '0')).join(':')
}

function formatTranscriptText(text) {
	return String(text || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean)
		.join('\n')
}

export default function SpeechToTextPage() {
	useInitModel()
	useSidebarClose()

	const currentModel = useCurrentModel()
	const [file, setFile] = useState(null)
	const [loading, setLoading] = useState(false)
	const [recording, setRecording] = useState(false)
	const [text, setText] = useState('')
	const [info, setInfo] = useState(null)
	const mediaRecorderRef = useRef(null)
	const streamRef = useRef(null)
	const chunksRef = useRef([])

	const onFileChange = (e) => {
		const nextFile = e.target.files?.[0] || null
		setFile(nextFile)
	}

	const transcribeAudio = async (audio) => {
		if (!currentModel?.model) return showToast('请先选择模型')

		setLoading(true)
		try {
			const data = await speechToTextWithApi({
				audio,
				model: currentModel.model,
				language: 'zh',
				task: 'transcribe'
			})
			setText(data.text || '')
			setInfo(data.info || {})
		} finally {
			setLoading(false)
		}
	}

	const onSubmit = async () => {
		if (!file) return showToast('请先选择音频文件')
		if (!currentModel?.model) return showToast('请先选择模型')

		try {
			const audio = await fileToBase64(file)
			await transcribeAudio(audio)
		} catch (error) {
			showToast(error.message || '语音转文字失败', 'error')
		}
	}

	const stopTracks = () => {
		if (streamRef.current) {
			streamRef.current.getTracks().forEach((track) => track.stop())
			streamRef.current = null
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
				const blob = new Blob(chunksRef.current, {
					type: mediaRecorderRef.current?.mimeType || 'audio/webm'
				})
				if (!blob.size) return

				try {
					const audio = await fileToBase64(blob)
					await transcribeAudio(audio)
				} catch (error) {
					showToast(error.message || '语音转文字失败', 'error')
				}
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
		<div className='p-4 h-full max-w-screen-md mx-auto w-full'>
			<Card>
				<CardHeader>
					<CardTitle>语音转文字</CardTitle>
					<CardDescription>
						上传音频文件，使用 Whisper 转写。默认优先按中文识别并输出简体中文。
					</CardDescription>
				</CardHeader>
				<CardContent className='space-y-4'>
					<Input
						type='file'
						accept='audio/*,.mp3,.wav,.m4a,.mp4,.mpeg,.mpga,.webm,.ogg'
						onChange={onFileChange}
						disabled={loading}
					/>
					<div className='flex gap-2'>
						<Button onClick={onSubmit} disabled={loading || !file || recording}>
							{loading ? '转写中...' : '上传并转写'}
						</Button>
						<Button
							variant={recording ? 'destructive' : 'outline'}
							onClick={recording ? stopRecord : startRecord}
							disabled={loading}
						>
							{recording ? <Square /> : <Mic />}
							{recording ? '结束录音并识别' : '开始录音'}
						</Button>
					</div>
					{info ? (
						<div className='text-sm text-muted-foreground space-y-1'>
							<div>识别语言: {info.language || 'zh'}</div>
							<div>语言置信度: {info.language_probability ?? '--'}</div>
							<div>音频时长: {formatDuration(info.duration)}</div>
						</div>
					) : null}
					<Textarea
						value={formatTranscriptText(text)}
						readOnly
						placeholder='转写结果会显示在这里'
						className='min-h-64 max-h-none'
					/>
				</CardContent>
			</Card>
		</div>
	)
}
