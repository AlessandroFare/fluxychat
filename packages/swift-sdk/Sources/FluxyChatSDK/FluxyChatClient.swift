import Foundation

public struct FluxyChatConfig: Sendable {
    public var apiUrl: String
    public var wsUrl: String
    public var projectId: String
    public var token: String

    public init(apiUrl: String, wsUrl: String, projectId: String, token: String) {
        self.apiUrl = apiUrl
        self.wsUrl = wsUrl
        self.projectId = projectId
        self.token = token
    }
}

public struct FluxyMessage: Codable, Sendable {
    public let id: Int
    public let roomId: String
    public let userId: String
    public let content: String
    public let createdAt: String
}

public enum FluxyChatError: Error, Sendable {
    case http(status: Int, body: String)
    case invalidURL
}

/// Minimal iOS/macOS REST + WebSocket client.
public final class FluxyChatClient: @unchecked Sendable {
    private var config: FluxyChatConfig
    public let webSocket: WebSocketClient

    public init(config: FluxyChatConfig) {
        self.config = config
        self.webSocket = WebSocketClient(config: config)
    }

    public func setToken(_ token: String) {
        config.token = token
        webSocket.setToken(token)
    }

    public func connectRoom(_ roomId: String, listener: WebSocketEventListener? = nil) {
        webSocket.listener = listener
        webSocket.connect(roomId: roomId)
    }

    public func disconnectRoom() {
        webSocket.disconnect()
    }

    public func listMessages(roomId: String, limit: Int = 50) async throws -> Data {
        try await get(path: "/rooms/\(roomId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? roomId)/messages?limit=\(limit)")
    }

    public func sendMessage(roomId: String, content: String, clientMessageId: String? = nil) async throws -> Data {
        var body: [String: String] = ["content": content]
        if let clientMessageId { body["clientMessageId"] = clientMessageId }
        let encoded = try JSONEncoder().encode(body)
        return try await post(path: "/rooms/\(roomId.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? roomId)/messages", body: encoded)
    }

    public func listRooms(limit: Int = 25) async throws -> Data {
        try await get(path: "/rooms?limit=\(limit)")
    }

    private func get(path: String) async throws -> Data {
        try await request(method: "GET", path: path, body: nil)
    }

    private func post(path: String, body: Data) async throws -> Data {
        try await request(method: "POST", path: path, body: body)
    }

    private func request(method: String, path: String, body: Data?) async throws -> Data {
        guard let url = URL(string: config.apiUrl.trimmingCharacters(in: CharacterSet(charactersIn: "/")) + path) else {
            throw FluxyChatError.invalidURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(config.token)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = body

        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw FluxyChatError.http(status: -1, body: "no response")
        }
        guard (200...299).contains(http.statusCode) else {
            let text = String(data: data, encoding: .utf8) ?? ""
            throw FluxyChatError.http(status: http.statusCode, body: text)
        }
        return data
    }
}
