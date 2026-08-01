package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO
import io.ktor.client.plugins.websocket.WebSockets

actual fun createFluxyHttpClient(): HttpClient = HttpClient(CIO) {
    install(WebSockets)
}
