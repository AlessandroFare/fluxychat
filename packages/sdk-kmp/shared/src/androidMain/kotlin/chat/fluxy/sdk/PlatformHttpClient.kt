package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp

actual fun createFluxyHttpClient(): HttpClient = HttpClient(OkHttp)
