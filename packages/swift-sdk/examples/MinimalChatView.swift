/**
 * Copy into an iOS/macOS SwiftUI app target that depends on FluxyChatSDK.
 *
 * Package.swift dependency:
 *   .package(path: "../swift-sdk")
 */
import FluxyChatSDK
import SwiftUI

struct MinimalChatView: View {
    let config: FluxyChatConfig
    let roomId: String

    @State private var client: FluxyChatClient
    @State private var messages: [FluxyMessage] = []
    @State private var draft = ""
    @State private var status: ConnectionStatus = .disconnected
    @State private var loadError: String?

    init(config: FluxyChatConfig, roomId: String) {
        self.config = config
        self.roomId = roomId
        _client = State(initialValue: FluxyChatClient(config: config))
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Status: \(statusLabel)")
                .font(.caption)
                .foregroundStyle(.secondary)

            if let loadError {
                Text(loadError)
                    .font(.caption)
                    .foregroundStyle(.red)
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 8) {
                    ForEach(messages, id: \.id) { message in
                        Text("\(message.userId): \(message.content)")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
            }

            HStack {
                TextField("Message", text: $draft)
                    .textFieldStyle(.roundedBorder)
                Button("Send") {
                    Task { await sendDraft() }
                }
                .disabled(draft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding()
        .task { await bootstrap() }
        .onDisappear { client.disconnectRoom() }
    }

    private var statusLabel: String {
        switch status {
        case .connected: return "connected"
        case .connecting: return "connecting"
        case .disconnected: return "disconnected"
        case .reconnecting: return "reconnecting"
        }
    }

    private func bootstrap() async {
        let listener = ChatListener { next in
            status = next
        } onEvent: { type, rawJson in
            guard type == "message", let message = decodeMessage(from: rawJson) else { return }
            messages.append(message)
        }
        client.connectRoom(roomId, listener: listener)

        do {
            let data = try await client.listMessages(roomId: roomId)
            messages = decodeMessages(from: data)
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func sendDraft() async {
        let content = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }
        do {
            _ = try await client.sendMessage(roomId: roomId, content: content)
            draft = ""
        } catch {
            loadError = error.localizedDescription
        }
    }

    private func decodeMessages(from data: Data) -> [FluxyMessage] {
        struct Payload: Decodable {
            let messages: [FluxyMessage]
        }
        return (try? JSONDecoder().decode(Payload.self, from: data).messages) ?? []
    }

    private func decodeMessage(from rawJson: String) -> FluxyMessage? {
        guard let data = rawJson.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(FluxyMessage.self, from: data)
    }
}

private final class ChatListener: WebSocketEventListener {
    private let onStatus: (ConnectionStatus) -> Void
    private let onEvent: (String, String) -> Void

    init(onStatus: @escaping (ConnectionStatus) -> Void, onEvent: @escaping (String, String) -> Void) {
        self.onStatus = onStatus
        self.onEvent = onEvent
    }

    func onStatusChange(_ status: ConnectionStatus) {
        onStatus(status)
    }

    func onEvent(type: String, rawJson: String) {
        onEvent(type, rawJson)
    }
}
