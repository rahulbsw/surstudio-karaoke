// swift-tools-version: 6.0
import PackageDescription

let package = Package(
  name: "SurStudioMac",
  platforms: [.macOS(.v14)],
  products: [.executable(name: "SurStudioMac", targets: ["SurStudioMac"])],
  targets: [
    .executableTarget(
      name: "SurStudioMac",
      path: "Sources/SurStudioMac",
      linkerSettings: [
        .linkedFramework("Accelerate"),
        .linkedFramework("AVFoundation"),
        .linkedFramework("WebKit"),
      ]
    ),
    .testTarget(
      name: "SurStudioMacTests",
      dependencies: ["SurStudioMac"],
      path: "Tests/SurStudioMacTests"
    ),
  ]
)
