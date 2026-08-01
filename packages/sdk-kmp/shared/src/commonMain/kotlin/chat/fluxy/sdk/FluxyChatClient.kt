package chat.fluxy.sdk

data class FluxyChatConfig(
    val apiUrl: String,
    val wsUrl: String,
    val projectId: String,
    var token: String,
    val userId: String? = null,
) {
    companion object {
        /** Derive ws URL from https Worker base (wss). */
        fun wsUrlFromApi(apiUrl: String): String =
            apiUrl.trimEnd('/')
                .replace("https://", "wss://")
                .replace("http://", "ws://")
    }
}

sealed class FluxyWsEvent {
    data class Message(val roomId: String, val payload: String) : FluxyWsEvent()
    data class Connection(val status: ConnectionStatus) : FluxyWsEvent()
    data class Error(val message: String) : FluxyWsEvent()
}

enum class ConnectionStatus {
    CONNECTING,
    CONNECTED,
    DISCONNECTED,
    RECONNECTING,
}

class FluxyChatClient(
    private val config: FluxyChatConfig,
) {
    private val socket = FluxyRoomWebSocket(config)
    private var listener: ((FluxyWsEvent) -> Unit)? = null

    fun setToken(token: String) {
        config.token = token
    }

    fun setEventListener(listener: ((FluxyWsEvent) -> Unit)?) {
        this.listener = listener
        socket.setEventListener(listener)
    }

    fun connectRoom(roomId: String) {
        socket.connect(roomId)
    }

    fun disconnectRoom() {
        socket.disconnect()
    }

    fun sendMessage(roomId: String, content: String, clientMessageId: String? = null): Result<Unit> {
        if (config.token.isBlank()) return Result.failure(IllegalStateException("token required"))
        if (content.isBlank()) return Result.failure(IllegalArgumentException("content required"))
        socket.sendMessage(content, clientMessageId)
        return Result.success(Unit)
    }

    fun sendTyping(typing: Boolean) {
        socket.sendTyping(typing)
    }
}
