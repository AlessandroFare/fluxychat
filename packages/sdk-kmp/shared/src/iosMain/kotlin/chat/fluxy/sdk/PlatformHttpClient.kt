package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin
import io.ktor.client.plugins.websocket.WebSockets

actual fun createFluxyHttpClient(): HttpClient = HttpClient(Darwin) {
    install(WebSockets)
}
