package chat.fluxy.sdk

data class FluxyChatConfig(
    val apiUrl: String,
    val wsUrl: String,
    val projectId: String,
    var token: String,
)

data class FluxyMessage(
    val id: Long,
    val roomId: String,
    val userId: String,
    val content: String,
    val createdAt: String,
)
