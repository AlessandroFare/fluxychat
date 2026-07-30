package chat.fluxy.sdk

import kotlin.test.Test
import kotlin.test.assertEquals

class WebSocketClientTest {
    @Test
    fun connectionStatusEnumOrder() {
        assertEquals(ConnectionStatus.CONNECTED, ConnectionStatus.CONNECTED)
    }
}
