import XCTest
@testable import FluxyChatSDK

final class FluxyChatSDKTests: XCTestCase {
    func testConfigProjectId() {
        let config = FluxyChatConfig(
            apiUrl: "https://example.com",
            wsUrl: "wss://example.com",
            projectId: "demo",
            token: "jwt"
        )
        XCTAssertEqual(config.projectId, "demo")
    }
}
