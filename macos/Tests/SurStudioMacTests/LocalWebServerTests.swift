import Darwin
import XCTest
@testable import SurStudioMac

final class LocalWebServerTests: XCTestCase {
  @MainActor
  func testPortSelectionSkipsAnOccupiedLoopbackPort() async throws {
    let occupiedPort = try XCTUnwrap(LocalWebServer.firstAvailablePort(in: 43_000...44_000))
    let descriptor = Darwin.socket(AF_INET, SOCK_STREAM, 0)
    XCTAssertGreaterThanOrEqual(descriptor, 0)
    defer { Darwin.close(descriptor) }

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(occupiedPort).bigEndian
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))
    let bindResult = withUnsafePointer(to: &address) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size))
      }
    }
    XCTAssertEqual(bindResult, 0)
    XCTAssertEqual(Darwin.listen(descriptor, 1), 0)

    let selectedPort = LocalWebServer.firstAvailablePort(in: occupiedPort...(occupiedPort + 20))
    XCTAssertNotNil(selectedPort)
    XCTAssertNotEqual(selectedPort, occupiedPort)

    let server = LocalWebServer(candidatePorts: occupiedPort...(occupiedPort + 20))
    let url = try await server.start()
    defer { server.stop() }
    XCTAssertNotEqual(url.port, occupiedPort)

    let (data, response) = try await URLSession.shared.data(from: url.appendingPathComponent("api/health"))
    XCTAssertEqual((response as? HTTPURLResponse)?.statusCode, 200)
    let health = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    XCTAssertEqual(health["service"] as? String, "surstudio")
  }
}
