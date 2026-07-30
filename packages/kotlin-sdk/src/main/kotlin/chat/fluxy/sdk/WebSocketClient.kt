package chat.fluxy.sdk

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import okio.ByteString
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/**
 * OkHttp WebSocket client with ping keepalive and exponential reconnect.
 * URL: `{wsUrl}/ws?roomId=&token=&projectId=`
 */
class WebSocketClient(
    private val config: FluxyChatConfig,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.IO),
    private val debug: Boolean = false,
) {
    private val http = OkHttpClient.Builder()
        .pingInterval(30, TimeUnit.SECONDS)
        .build()

    private var socket: WebSocket? = null
    private var roomId: String? = null
    private var status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    private var listener: WebSocketEventListener? = null
    private val reconnectAttempts = AtomicInteger(0)
    private var pingJob: Job? = null
    private var reconnectJob: Job? = null
    private val maxReconnectAttempts = 10

    fun setListener(listener: WebSocketEventListener?) {
        this.listener = listener
    }

    fun connect(targetRoomId: String) {
        disconnectInternal(resetAttempts = true)
        roomId = targetRoomId
        reconnectAttempts.set(0)
        openSocket(targetRoomId)
    }

    fun disconnect() {
        disconnectInternal(resetAttempts = true)
    }

    fun sendRaw(json: String) {
        socket?.send(json) ?: log("send skipped — not connected")
    }

    fun sendMessage(content: String, clientMessageId: String? = null) {
        val body = buildString {
            append("{\"type\":\"message\",\"content\":")
            append(jsonString(content))
            if (clientMessageId != null) {
                append(",\"clientMessageId\":")
                append(jsonString(clientMessageId))
            }
            append("}")
        }
        sendRaw(body)
    }

    fun sendTyping(typing: Boolean) {
        val id = roomId ?: return
        sendRaw("{\"type\":\"typing\",\"roomId\":${jsonString(id)},\"typing\":$typing}")
    }

    fun sendPing() {
        sendRaw("{\"type\":\"ping\"}")
    }

    private fun openSocket(targetRoomId: String) {
        setStatus(ConnectionStatus.CONNECTING)
        val url =
            "${config.wsUrl.trimEnd('/')}/ws?roomId=${encode(targetRoomId)}&token=${encode(config.token)}&projectId=${encode(config.projectId)}"
        val request = Request.Builder().url(url).build()
        socket = http.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                reconnectAttempts.set(0)
                setStatus(ConnectionStatus.CONNECTED)
                startPingLoop()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val type = parseEventType(text)
                listener?.onEvent(type, text)
            }

            override fun onMessage(webSocket: WebSocket, bytes: ByteString) {
                onMessage(webSocket, bytes.utf8())
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(code, reason)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                stopPingLoop()
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                log("failure: ${t.message}")
                stopPingLoop()
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        val id = roomId ?: return
        if (reconnectAttempts.get() >= maxReconnectAttempts) {
            setStatus(ConnectionStatus.DISCONNECTED)
            return
        }
        setStatus(ConnectionStatus.RECONNECTING)
        val attempt = reconnectAttempts.incrementAndGet()
        val delayMs = (1000L shl (attempt - 1).coerceAtMost(5)).coerceAtMost(30_000L)
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(delayMs)
            if (isActive && roomId == id) openSocket(id)
        }
    }

    private fun startPingLoop() {
        stopPingLoop()
        pingJob = scope.launch {
            while (isActive && status == ConnectionStatus.CONNECTED) {
                delay(30_000)
                sendPing()
            }
        }
    }

    private fun stopPingLoop() {
        pingJob?.cancel()
        pingJob = null
    }

    private fun disconnectInternal(resetAttempts: Boolean) {
        reconnectJob?.cancel()
        stopPingLoop()
        roomId = null
        socket?.close(1000, "client disconnect")
        socket = null
        if (resetAttempts) reconnectAttempts.set(maxReconnectAttempts)
        setStatus(ConnectionStatus.DISCONNECTED)
    }

    private fun setStatus(next: ConnectionStatus) {
        status = next
        listener?.onStatusChange(next)
    }

    private fun parseEventType(raw: String): String {
        val key = "\"type\":"
        val idx = raw.indexOf(key)
        if (idx < 0) return "unknown"
        val start = raw.indexOf('"', idx + key.length) + 1
        val end = raw.indexOf('"', start)
        if (start <= 0 || end <= start) return "unknown"
        return raw.substring(start, end)
    }

    private fun encode(value: String): String =
        java.net.URLEncoder.encode(value, Charsets.UTF_8)

    private fun jsonString(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""

    private fun log(message: String) {
        if (debug) println("[FluxyChat WS] $message")
    }
}
