import Foundation

final class LocalAIWorker: @unchecked Sendable {
  private final class Execution: @unchecked Sendable {
    let process: Process
    let output: Pipe
    let error: Pipe

    init(process: Process, output: Pipe, error: Pipe) {
      self.process = process
      self.output = output
      self.error = error
    }
  }

  var isAvailable: Bool { locatePython() != nil && locateScript() != nil }

  func run(kind: String, inputPath: String? = nil, lyrics: String? = nil) async throws -> [String: Any] {
    guard ["probe", "separate", "transcribe", "align"].contains(kind) else { throw WorkerError.invalidJob }
    guard let python = locatePython(), let script = locateScript() else { throw WorkerError.unavailable }

    let fileManager = FileManager.default
    let jobID = UUID().uuidString
    let jobsRoot = try fileManager.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true)
      .appendingPathComponent("SurStudio/Jobs/\(jobID)", isDirectory: true)
    try fileManager.createDirectory(at: jobsRoot, withIntermediateDirectories: true)

    var arguments = [script.path, kind, "--output", jobsRoot.path]
    if kind != "probe" {
      guard let inputPath, fileManager.isReadableFile(atPath: inputPath) else { throw WorkerError.invalidInput }
      arguments += ["--input", inputPath]
    }
    if let lyrics, !lyrics.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
      let lyricsURL = jobsRoot.appendingPathComponent("lyrics.txt")
      try lyrics.write(to: lyricsURL, atomically: true, encoding: .utf8)
      arguments += ["--lyrics-file", lyricsURL.path]
    }

    let process = Process()
    let output = Pipe()
    let error = Pipe()
    process.executableURL = python
    process.arguments = python.lastPathComponent == "env" ? ["python3"] + arguments : arguments
    process.standardOutput = output
    process.standardError = error
    process.environment = ProcessInfo.processInfo.environment.merging(["PYTHONUNBUFFERED": "1"]) { _, value in value }
    let execution = Execution(process: process, output: output, error: error)

    return try await withCheckedThrowingContinuation { continuation in
      execution.process.terminationHandler = { _ in
        let outputData = execution.output.fileHandleForReading.readDataToEndOfFile()
        let errorData = execution.error.fileHandleForReading.readDataToEndOfFile()
        if execution.process.terminationStatus != 0 {
          let message = String(data: errorData, encoding: .utf8) ?? "The local worker failed."
          continuation.resume(throwing: WorkerError.failed(message.trimmingCharacters(in: .whitespacesAndNewlines)))
          return
        }
        do {
          guard let value = try JSONSerialization.jsonObject(with: outputData) as? [String: Any] else { throw WorkerError.invalidResponse }
          continuation.resume(returning: value)
        } catch {
          continuation.resume(throwing: WorkerError.invalidResponse)
        }
      }
      do {
        try execution.process.run()
      } catch {
        continuation.resume(throwing: error)
      }
    }
  }

  private func locateScript() -> URL? {
    let fileManager = FileManager.default
    let candidates = [
      Bundle.main.resourceURL?.appendingPathComponent("WebApp/workers/surstudio_worker.py"),
      URL(fileURLWithPath: fileManager.currentDirectoryPath).appendingPathComponent("macos/workers/surstudio_worker.py"),
      URL(fileURLWithPath: fileManager.currentDirectoryPath).deletingLastPathComponent().appendingPathComponent("macos/workers/surstudio_worker.py"),
    ].compactMap { $0 }
    return candidates.first(where: { fileManager.fileExists(atPath: $0.path) })
  }

  private func locatePython() -> URL? {
    let override = ProcessInfo.processInfo.environment["SURSTUDIO_PYTHON_PATH"]
    let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first
    let managedPython = applicationSupport?.appendingPathComponent("SurStudio/AI/venv/bin/python3").path
    let candidates = [override, managedPython, "/opt/homebrew/bin/python3.11", "/opt/homebrew/bin/python3.12", "/opt/homebrew/bin/python3", "/usr/local/bin/python3", "/opt/local/bin/python3", "/usr/bin/python3", "/usr/bin/env"].compactMap { $0 }
    return candidates.first(where: { FileManager.default.isExecutableFile(atPath: $0) }).map(URL.init(fileURLWithPath:))
  }

  enum WorkerError: LocalizedError {
    case unavailable
    case invalidJob
    case invalidInput
    case invalidResponse
    case failed(String)

    var errorDescription: String? {
      switch self {
      case .unavailable: "The optional local AI pack is not installed in this SurStudio build. You can still attach a pre-separated instrumental."
      case .invalidJob: "This local AI job is not supported."
      case .invalidInput: "Choose a readable local audio or video file."
      case .invalidResponse: "The local AI worker returned an unreadable result."
      case .failed(let message): message
      }
    }
  }
}
