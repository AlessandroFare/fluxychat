// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "FluxyChatSDK",
    platforms: [
        .iOS(.v15),
        .macOS(.v12),
    ],
    products: [
        .library(name: "FluxyChatSDK", targets: ["FluxyChatSDK"]),
    ],
    targets: [
        .target(name: "FluxyChatSDK"),
        .testTarget(name: "FluxyChatSDKTests", dependencies: ["FluxyChatSDK"]),
    ]
)
