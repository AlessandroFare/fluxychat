package chat.fluxy.sdk

import kotlin.test.Test
import kotlin.test.assertTrue

class FluxyChatClientTest {
    @Test
    fun configStoresProjectId() {
        val config = FluxyChatConfig(
            apiUrl = "http://127.0.0.1:8787",
            wsUrl = "ws://127.0.0.1:8787",
            projectId = "demo",
            token = "test",
        )
        assertTrue(config.projectId == "demo")
    }
}
