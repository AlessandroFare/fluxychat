package chat.fluxy.sdk

import io.ktor.client.HttpClient

expect fun createFluxyHttpClient(): HttpClient
