package chat.fluxy.sdk

import io.ktor.client.HttpClient
import io.ktor.client.engine.darwin.Darwin

actual fun createFluxyHttpClient(): HttpClient = HttpClient(Darwin)
