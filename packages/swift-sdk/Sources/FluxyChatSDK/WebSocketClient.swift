import Foundation

/// URLSessionWebSocketTask client with ping keepalive and exponential reconnect.
public final class WebSocketClient: @unchecked Sendable {
    private var config: FluxyChatConfig
    private var task: URLSessionWebSocketTask?
    private var roomId: String?
    private var status: ConnectionStatus = .disconnected
    public weak var listener: WebSocketEventListener?
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 10
    private var pingTask: Task<Void, Never>?
    private var receiveTask: Task<Void, Never>?
    private var reconnectTask: Task<Void, Never>?

    public init(config: FluxyChatConfig) {
        self.config = config
    }

    public func setToken(_ token: String) {
        config.token = token
    }

    public func connect(roomId: String) {
        disconnect(resetAttempts: true)
        self.roomId = roomId
        reconnectAttempts = 0
        openSocket(roomId: roomId)
    }

    public func disconnect() {
        disconnect(resetAttempts: true)
    }

    public func sendRaw(_ json: String) async throws {
        guard let task else { return }
        try await task.send(.string(json))
    }

    public func sendMessage(_ content: String, clientMessageId: String? = nil) async throws {
        var payload: [String: String] = ["type": "message", "content": content]
        if let clientMessageId { payload["clientMessageId"] = clientMessageId }
        let data = try JSONEncoder().encode(payload)
        guard let json = String(data: data, encoding: .utf8) else { return }
        try await sendRaw(json)
    }

    public func sendTyping(_ typing: Bool) async throws {
        guard let roomId else { return }
        let json = "{\"type\":\"typing\",\"roomId\":\"\(roomId)\",\"typing\":\(typing)}"
        try await sendRaw(json)
    }

    private func openSocket(roomId: String) {
        setStatus(.connecting)
        guard let url = buildURL(roomId: roomId) else {
            setStatus(.disconnected)
            return
        }
        task = URLSession.shared.webSocketTask(with: url)
        task?.resume()
        setStatus(.connected)
        startReceiveLoop()
        startPingLoop()
    }

    private func buildURL(roomId: String) -> URL? {
        var components = URLComponents(string: config.wsUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + "/ws")
        components?.queryItems = [
            URLQueryItem(name: "roomId", value: roomId),
            URLQueryItem(name: "token", value: config.token),
            URLQueryItem(name: "projectId", value: config.projectId),
        ]
        return components?.url
    }

    private func startReceiveLoop() {
        receiveTask?.cancel()
        receiveTask = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                guard let task = self.task else { break }
                do {
                    let message = try await task.receive()
                    switch message {
                    case .string(let text):
                        let type = Self.parseEventType(text)
                        await MainActor.run {
                            self.listener?.onEvent(type: type, rawJson: text)
                        }
                    case .data(let data):
                        if let text = String(data: data, encoding: .utf8) {
                            let type = Self.parseEventType(text)
                            await MainActor.run {
                                self.listener?.onEvent(type: type, rawJson: text)
                            }
                        }
                    @unknown default:
                        break
                    }
                } catch {
                    await MainActor.run {
                        self.scheduleReconnect()
                    }
                    break
                }
            }
        }
    }

    private func startPingLoop() {
        pingTask?.cancel()
        pingTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 30_000_000_000)
                try? await self?.sendRaw("{\"type\":\"ping\"}")
            }
        }
    }

    private func scheduleReconnect() {
        guard let roomId else { return }
        if reconnectAttempts >= maxReconnectAttempts {
            setStatus(.disconnected)
            return
        }
        setStatus(.reconnecting)
        reconnectAttempts += 1
        let delayMs = min(30_000, 1_000 << min(reconnectAttempts - 1, 5))
        reconnectTask?.cancel()
        reconnectTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: UInt64(delayMs) * 1_000_000)
            await MainActor.run {
                self?.openSocket(roomId: roomId)
            }
        }
    }

    private func disconnect(resetAttempts: Bool) {
        pingTask?.cancel()
        receiveTask?.cancel()
        reconnectTask?.cancel()
        task?.cancel(with: .goingAway, reason: nil)
        task = nil
        roomId = nil
        if resetAttempts { reconnectAttempts = maxReconnectAttempts }
        setStatus(.disconnected)
    }

    private func setStatus(_ next: ConnectionStatus) {
        status = next
        listener?.onStatusChange(next)
    }

    private static func parseEventType(_ raw: String) -> String {
        guard let data = raw.data(using: .utf8),
              let obj = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let type = obj["type"] as? String else {
            return "unknown"
        }
        return type
    }
}
