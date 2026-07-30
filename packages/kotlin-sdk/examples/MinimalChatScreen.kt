/**
 * Copy into an Android app module with Jetpack Compose enabled.
 *
 * Gradle (app/build.gradle.kts):
 *   implementation("chat.fluxy:sdk:0.1.0-SNAPSHOT")
 *   implementation(platform("androidx.compose:compose-bom:2024.10.01"))
 *   implementation("androidx.compose.ui:ui")
 *   implementation("androidx.compose.material3:material3")
 *   implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.6")
 */
package chat.fluxy.sdk.examples

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import chat.fluxy.sdk.ConnectionStatus
import chat.fluxy.sdk.FluxyChatClient
import chat.fluxy.sdk.FluxyChatConfig
import chat.fluxy.sdk.FluxyMessage
import chat.fluxy.sdk.WebSocketEventListener
import org.json.JSONArray
import org.json.JSONObject

@Composable
fun MinimalChatScreen(
    apiUrl: String,
    wsUrl: String,
    projectId: String,
    token: String,
    roomId: String,
) {
    val client = remember(apiUrl, wsUrl, projectId, token) {
        FluxyChatClient(
            FluxyChatConfig(
                apiUrl = apiUrl,
                wsUrl = wsUrl,
                projectId = projectId,
                token = token,
            ),
        )
    }
    val messages = remember { mutableStateListOf<FluxyMessage>() }
    var draft by remember { mutableStateOf("") }
    var status by remember { mutableStateOf(ConnectionStatus.DISCONNECTED) }

    DisposableEffect(roomId) {
        client.connectRoom(
            roomId,
            object : WebSocketEventListener {
                override fun onStatusChange(next: ConnectionStatus) {
                    status = next
                }

                override fun onEvent(type: String, rawJson: String) {
                    if (type == "message") {
                        parseMessage(rawJson)?.let { messages.add(it) }
                    }
                }
            },
        )
        runCatching {
            val payload = client.listMessages(roomId)
            parseMessages(payload).forEach { messages.add(it) }
        }
        onDispose { client.disconnectRoom() }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Status: $status")
        LazyColumn(
            modifier = Modifier.weight(1f).fillMaxWidth(),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            items(messages, key = { it.id }) { message ->
                Text("${message.userId}: ${message.content}")
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                value = draft,
                onValueChange = { draft = it },
                modifier = Modifier.weight(1f),
                label = { Text("Message") },
            )
            Button(
                onClick = {
                    val content = draft.trim()
                    if (content.isEmpty()) return@Button
                    runCatching {
                        client.sendMessage(roomId, content)
                        draft = ""
                    }
                },
            ) {
                Text("Send")
            }
        }
    }
}

private fun parseMessages(payload: String): List<FluxyMessage> {
    val root = JSONObject(payload)
    val rows = root.optJSONArray("messages") ?: JSONArray()
    return buildList {
        for (index in 0 until rows.length()) {
            parseMessage(rows.getJSONObject(index).toString())?.let(::add)
        }
    }
}

private fun parseMessage(raw: String): FluxyMessage? {
    val json = JSONObject(raw)
    val content = json.optString("content")
    if (content.isEmpty()) return null
    return FluxyMessage(
        id = json.optLong("id"),
        roomId = json.optString("roomId"),
        userId = json.optString("userId"),
        content = content,
        createdAt = json.optString("createdAt"),
    )
}
