package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.cio.CIO

actual fun createFluxyHttpClient(): HttpClient = HttpClient(CIO)
