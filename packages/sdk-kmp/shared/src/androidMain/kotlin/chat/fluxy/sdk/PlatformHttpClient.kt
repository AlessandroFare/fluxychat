package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.plugins.websocket.WebSockets

actual fun createFluxyHttpClient(): HttpClient = HttpClient(OkHttp) {
    install(WebSockets)
}
