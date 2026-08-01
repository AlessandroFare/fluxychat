package chat.fluxy.sdk

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FluxyChatClientTest {
    @Test
    fun sendMessageRequiresToken() {
        val config = FluxyChatConfig(
            apiUrl = "https://example.com",
            wsUrl = "wss://example.com",
            projectId = "proj-1",
            token = "",
        )
        val client = FluxyChatClient(config)
        assertTrue(client.sendMessage("general", "hi").isFailure)
    }

    @Test
    fun wsUrlFromApi() {
        assertEquals(
            "wss://api.fluxy.com",
            FluxyChatConfig.wsUrlFromApi("https://api.fluxy.com"),
        )
    }

    @Test
    fun setTokenUpdatesConfig() {
        val config = FluxyChatConfig(
            apiUrl = "https://example.com",
            wsUrl = "wss://example.com",
            projectId = "proj-1",
            token = "a",
        )
        val client = FluxyChatClient(config)
        client.setToken("b")
        assertEquals("b", config.token)
    }
}
