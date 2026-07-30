import Foundation

public enum ConnectionStatus: String, Sendable {
    case disconnected
    case connecting
    case connected
    case reconnecting
}

public protocol WebSocketEventListener: AnyObject {
    func onEvent(type: String, rawJson: String)
    func onStatusChange(_ status: ConnectionStatus)
}
