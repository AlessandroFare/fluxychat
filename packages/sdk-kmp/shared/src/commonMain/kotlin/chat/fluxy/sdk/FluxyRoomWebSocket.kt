package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.plugins.websocket.DefaultClientWebSocketSession
import io.ktor.client.plugins.websocket.WebSockets
import io.ktor.client.plugins.websocket.webSocketSession
import io.ktor.websocket.Frame
import io.ktor.websocket.readText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

expect fun createFluxyHttpClient(): HttpClient

class FluxyRoomWebSocket(
    private val config: FluxyChatConfig,
    private val scope: CoroutineScope = CoroutineScope(Dispatchers.Default),
) {
    private val client = createFluxyHttpClient().config { install(WebSockets) }
    private var session: DefaultClientWebSocketSession? = null
    private var roomId: String? = null
    private var pingJob: Job? = null
    private var listener: ((FluxyWsEvent) -> Unit)? = null

    fun setEventListener(listener: ((FluxyWsEvent) -> Unit)?) {
        this.listener = listener
    }

    fun connect(targetRoomId: String) {
        disconnect()
        roomId = targetRoomId
        scope.launch {
            listener?.invoke(FluxyWsEvent.Connection(ConnectionStatus.CONNECTING))
            try {
                val url = buildWsUrl(targetRoomId)
                session = client.webSocketSession(url)
                listener?.invoke(FluxyWsEvent.Connection(ConnectionStatus.CONNECTED))
                startPingLoop()
                val ws = session ?: return@launch
                for (frame in ws.incoming) {
                    if (frame is Frame.Text) {
                        val text = frame.readText()
                        listener?.invoke(FluxyWsEvent.Message(targetRoomId, text))
                    }
                }
            } catch (err: Throwable) {
                listener?.invoke(FluxyWsEvent.Error(err.message ?: "websocket_error"))
            } finally {
                listener?.invoke(FluxyWsEvent.Connection(ConnectionStatus.DISCONNECTED))
            }
        }
    }

    fun disconnect() {
        pingJob?.cancel()
        pingJob = null
        scope.launch {
            try {
                session?.close()
            } catch (_: Throwable) {
            }
            session = null
            roomId = null
        }
    }

    fun sendMessage(content: String, clientMessageId: String? = null) {
        val body = buildString {
            append("""{"type":"message","content":""")
            append(jsonString(content))
            if (clientMessageId != null) {
                append(""","clientMessageId":""")
                append(jsonString(clientMessageId))
                append('"')
            }
            append("}")
        }
        sendRaw(body)
    }

    fun sendTyping(typing: Boolean) {
        val id = roomId ?: return
        sendRaw("""{"type":"typing","roomId":${jsonString(id)},"typing":$typing}""")
    }

    private fun sendRaw(json: String) {
        scope.launch {
            try {
                session?.send(Frame.Text(json))
            } catch (err: Throwable) {
                listener?.invoke(FluxyWsEvent.Error(err.message ?: "send_failed"))
            }
        }
    }

    private fun startPingLoop() {
        pingJob?.cancel()
        pingJob = scope.launch {
            while (isActive && session != null) {
                delay(30_000)
                sendRaw("""{"type":"ping"}""")
            }
        }
    }

    private fun buildWsUrl(targetRoomId: String): String {
        val base = config.wsUrl.trimEnd('/')
        val token = encodeURIComponent(config.token)
        val room = encodeURIComponent(targetRoomId)
        val project = encodeURIComponent(config.projectId)
        return "$base/ws?roomId=$room&token=$token&projectId=$project"
    }

    private fun encodeURIComponent(value: String): String =
        value.encodeToByteArray().joinToString("") { b ->
            val c = b.toInt() and 0xFF
            when {
                c in 'a'.code..'z'.code || c in 'A'.code..'Z'.code || c in '0'.code..'9'.code ||
                    c == '-'.code || c == '_'.code || c == '.'.code || c == '~'.code -> c.toChar().toString()
                else -> "%${c.toString(16).uppercase().padStart(2, '0')}"
            }
        }

    private fun jsonString(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
}
