import Foundation
import Darwin

@MainActor
final class LocalWebServer {
  static let shared = LocalWebServer()

  private var process: Process?
  private var port: Int
  private let candidatePorts: ClosedRange<Int>

  init(candidatePorts: ClosedRange<Int> = 4174...4214) {
    self.candidatePorts = candidatePorts
    self.port = candidatePorts.lowerBound
  }

  func start(forceRestart: Bool = false) async throws -> URL {
    if forceRestart { stop() }
    if let process, process.isRunning, await isHealthy() { return appURL }
    if let existingPort = await existingSurStudioPort() {
      port = existingPort
      return appURL
    }

    guard let availablePort = Self.firstAvailablePort(in: candidatePorts) else {
      throw ServerError.noAvailablePort
    }
    port = availablePort

    let root = try locateWebRoot()
    let node = try locateExecutable(named: "node")
    let serverEntry = try locateServerEntry(in: root)
    let mediaRoot = try ensureUserMediaRoot()
    let task = Process()
    let logPipe = Pipe()
    task.currentDirectoryURL = root
    task.standardOutput = logPipe
    task.standardError = logPipe
    task.environment = ProcessInfo.processInfo.environment.merging([
      "API_PORT": String(port),
      "NODE_ENV": "production",
      "SURSTUDIO_ENV_PATH": userEnvironmentPath,
      "SURSTUDIO_MEDIA_ROOT": mediaRoot.path,
      "SURSTUDIO_APP_ROOT": root.path,
    ]) { _, packaged in packaged }

    if node.lastPathComponent == "env" {
      task.executableURL = node
      task.arguments = ["node", serverEntry.path]
    } else {
      task.executableURL = node
      task.arguments = [serverEntry.path]
    }

    try task.run()
    process = task

    for _ in 0..<80 {
      if await isHealthy() { return appURL }
      if !task.isRunning {
        let data = logPipe.fileHandleForReading.readDataToEndOfFile()
        let log = String(data: data, encoding: .utf8) ?? "The local server exited before it became ready."
        throw ServerError.startFailed(log.trimmingCharacters(in: .whitespacesAndNewlines))
      }
      try await Task.sleep(for: .milliseconds(150))
    }

    task.terminate()
    throw ServerError.timedOut
  }

  func stop() {
    guard let process, process.isRunning else { return }
    process.terminate()
    self.process = nil
  }

  private var appURL: URL { URL(string: "http://127.0.0.1:\(port)")! }

  private var userEnvironmentPath: String {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    return applicationSupport.appendingPathComponent("SurStudio/.env").path
  }

  private func ensureUserMediaRoot() throws -> URL {
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
    let mediaRoot = applicationSupport.appendingPathComponent("SurStudio/Media", isDirectory: true)
    try FileManager.default.createDirectory(at: mediaRoot, withIntermediateDirectories: true)
    return mediaRoot
  }

  private func isHealthy() async -> Bool {
    await isHealthy(port: port)
  }

  private func isHealthy(port: Int) async -> Bool {
    do {
      let healthURL = URL(string: "http://127.0.0.1:\(port)/api/health")!
      var request = URLRequest(url: healthURL)
      request.timeoutInterval = 0.5
      let (data, response) = try await URLSession.shared.data(for: request)
      guard (response as? HTTPURLResponse)?.statusCode == 200 else { return false }
      let health = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
      return health?["ok"] as? Bool == true && health?["service"] as? String == "surstudio"
    } catch {
      return false
    }
  }

  private func existingSurStudioPort() async -> Int? {
    for candidate in candidatePorts {
      guard !Self.isPortAvailable(candidate) else { continue }
      if await isHealthy(port: candidate) { return candidate }
    }
    return nil
  }

  static func firstAvailablePort(in candidates: ClosedRange<Int>) -> Int? {
    candidates.first(where: isPortAvailable)
  }

  private static func isPortAvailable(_ candidate: Int) -> Bool {
    let descriptor = Darwin.socket(AF_INET, SOCK_STREAM, 0)
    guard descriptor >= 0 else { return false }
    defer { Darwin.close(descriptor) }

    var address = sockaddr_in()
    address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    address.sin_family = sa_family_t(AF_INET)
    address.sin_port = in_port_t(candidate).bigEndian
    address.sin_addr = in_addr(s_addr: inet_addr("127.0.0.1"))

    return withUnsafePointer(to: &address) { pointer in
      pointer.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
      }
    }
  }

  private func locateWebRoot() throws -> URL {
    let fileManager = FileManager.default
    let candidates = [
      Bundle.main.resourceURL?.appendingPathComponent("WebApp"),
      URL(fileURLWithPath: fileManager.currentDirectoryPath),
      URL(fileURLWithPath: fileManager.currentDirectoryPath).deletingLastPathComponent(),
    ].compactMap { $0 }

    if let root = candidates.first(where: {
      (fileManager.fileExists(atPath: $0.appendingPathComponent("server.cjs").path)
        || fileManager.fileExists(atPath: $0.appendingPathComponent("server.mjs").path))
        && fileManager.fileExists(atPath: $0.appendingPathComponent("dist/index.html").path)
    }) {
      return root
    }
    throw ServerError.missingWebBuild
  }

  private func locateServerEntry(in root: URL) throws -> URL {
    let fileManager = FileManager.default
    let candidates = [root.appendingPathComponent("server.cjs"), root.appendingPathComponent("server.mjs")]
    guard let entry = candidates.first(where: { fileManager.fileExists(atPath: $0.path) }) else {
      throw ServerError.missingWebBuild
    }
    return entry
  }

  private func locateExecutable(named name: String) throws -> URL {
    let environmentOverride = ProcessInfo.processInfo.environment["SURSTUDIO_\(name.uppercased())_PATH"]
    let bundledRuntime = Bundle.main.resourceURL?.appendingPathComponent("Runtime/bin/\(name)").path
    let candidates = [
      environmentOverride,
      bundledRuntime,
      "/opt/homebrew/bin/\(name)",
      "/usr/local/bin/\(name)",
      "/opt/local/bin/\(name)",
      "/usr/bin/\(name)",
      "/usr/bin/env",
    ].compactMap { $0 }
    if let path = candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }) {
      return URL(fileURLWithPath: path)
    }
    throw ServerError.missingNode
  }

  enum ServerError: LocalizedError {
    case missingWebBuild
    case missingNode
    case startFailed(String)
    case timedOut
    case noAvailablePort

    var errorDescription: String? {
      switch self {
      case .missingWebBuild: "The packaged React build is missing. Run npm run mac:build from the project folder."
      case .missingNode: "Node.js was not found. Install Node 20 or set SURSTUDIO_NODE_PATH."
      case .startFailed(let log): "The local server stopped: \(log)"
      case .timedOut: "The local server did not become ready in time."
      case .noAvailablePort: "SurStudio could not find a free local port between 4174 and 4214."
      }
    }
  }
}
