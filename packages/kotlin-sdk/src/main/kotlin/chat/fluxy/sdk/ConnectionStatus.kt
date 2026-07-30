package chat.fluxy.sdk

enum class ConnectionStatus {
    DISCONNECTED,
    CONNECTING,
    CONNECTED,
    RECONNECTING,
}

interface WebSocketEventListener {
    fun onEvent(type: String, rawJson: String)
    fun onStatusChange(status: ConnectionStatus)
}
