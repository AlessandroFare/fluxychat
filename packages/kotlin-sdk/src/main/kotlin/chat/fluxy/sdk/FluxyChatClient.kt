package chat.fluxy.sdk

import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

/**
 * Minimal JVM/Android REST client for FluxyChat rooms and messages.
 * WebSocket streaming: use OkHttp WebSocket or platform WS with the same JWT + room subscribe URL.
 */
class FluxyChatClient(
    private val config: FluxyChatConfig,
    debugWebSocket: Boolean = false,
) {
    val webSocket: WebSocketClient = WebSocketClient(config, debug = debugWebSocket)

    fun setToken(token: String) {
        config.token = token
    }

    fun connectRoom(roomId: String, listener: WebSocketEventListener? = null) {
        webSocket.setListener(listener)
        webSocket.connect(roomId)
    }

    fun disconnectRoom() {
        webSocket.disconnect()
    }

    fun listMessages(roomId: String, limit: Int = 50): String {
        val q = "limit=${URLEncoder.encode(limit.toString(), StandardCharsets.UTF_8)}"
        return get("/rooms/${encode(roomId)}/messages?$q")
    }

    fun sendMessage(roomId: String, content: String, clientMessageId: String? = null): String {
        val body = buildString {
            append("{\"content\":")
            append(jsonString(content))
            if (clientMessageId != null) {
                append(",\"clientMessageId\":")
                append(jsonString(clientMessageId))
            }
            append("}")
        }
        return post("/rooms/${encode(roomId)}/messages", body)
    }

    fun listRooms(limit: Int = 25): String = get("/rooms?limit=$limit")

    private fun get(path: String): String = request("GET", path, null)

    private fun post(path: String, body: String): String = request("POST", path, body)

    private fun request(method: String, path: String, body: String?): String {
        val url = URI("${config.apiUrl.trimEnd('/')}$path").toURL()
        val conn = url.openConnection() as HttpURLConnection
        conn.requestMethod = method
        conn.setRequestProperty("Authorization", "Bearer ${config.token}")
        conn.setRequestProperty("Content-Type", "application/json")
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        if (body != null) {
            conn.doOutput = true
            conn.outputStream.use { it.write(body.toByteArray(StandardCharsets.UTF_8)) }
        }
        val code = conn.responseCode
        val stream = if (code in 200..299) conn.inputStream else conn.errorStream
        val text = stream?.bufferedReader()?.use { it.readText() } ?: ""
        if (code !in 200..299) {
            throw FluxyChatException("HTTP $code: $text")
        }
        return text
    }

    private fun encode(value: String): String =
        URLEncoder.encode(value, StandardCharsets.UTF_8)

    private fun jsonString(value: String): String =
        "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""
}

class FluxyChatException(message: String) : RuntimeException(message)
