import AppKit
import Foundation
import WebKit

@MainActor
final class NativeBridge: NSObject, WKScriptMessageHandler {
  private weak var webView: WKWebView?
  private let audio = NativeAudioService()
  private let worker = LocalAIWorker()
  private var sharingPicker: NSSharingServicePicker?

  func attach(to webView: WKWebView) {
    self.webView = webView
  }

  func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    guard message.frameInfo.isMainFrame,
          message.frameInfo.request.url?.host == "127.0.0.1",
          let body = message.body as? [String: Any],
          let id = body["id"] as? String,
          let method = body["method"] as? String else { return }
    let parameters = body["params"] as? [String: Any] ?? [:]

    switch method {
    case "capabilities":
      respond(id: id, result: capabilities())
    case "requestMicrophone":
      audio.requestPermission { [weak self] granted in
        Task { @MainActor in self?.respond(id: id, result: ["granted": granted]) }
      }
    case "startAudioMonitor":
      audio.requestPermission { [weak self] granted in
        guard let self else { return }
        Task { @MainActor in
          guard granted else {
            self.respond(id: id, error: "Microphone access was not granted.")
            return
          }
          do {
            try self.audio.start { [weak self] sample in
              Task { @MainActor in self?.emit(name: "surstudio:native-audio", detail: sample.dictionary) }
            }
            self.respond(id: id, result: ["monitoring": true])
          } catch {
            self.respond(id: id, error: error.localizedDescription)
          }
        }
      }
    case "stopAudioMonitor":
      audio.stop()
      respond(id: id, result: ["monitoring": false])
    case "selectAudioFile":
      selectAudioFile(id: id)
    case "probeLocalAI":
      runWorker(id: id, kind: "probe", parameters: parameters)
    case "runLocalAI":
      guard let kind = parameters["kind"] as? String else {
        respond(id: id, error: "Choose a local AI task.")
        return
      }
      runWorker(id: id, kind: kind, parameters: parameters)
    case "publishLocalMedia":
      publishLocalMedia(id: id, parameters: parameters)
    case "shareScoreCard":
      shareScoreCard(id: id, parameters: parameters)
    case "revealFile":
      if let path = parameters["path"] as? String, FileManager.default.fileExists(atPath: path) {
        NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: path)])
        respond(id: id, result: ["revealed": true])
      } else {
        respond(id: id, error: "That local result is no longer available.")
      }
    default:
      respond(id: id, error: "Unknown native method: \(method)")
    }
  }

  private func capabilities() -> [String: Any] {
    #if arch(arm64)
    let appleSilicon = true
    #else
    let appleSilicon = false
    #endif
    return [
      "native": true,
      "platform": "macOS",
      "appleSilicon": appleSilicon,
      "avAudioEngine": true,
      "accelerate": true,
      "localAIWorker": worker.isAvailable,
      "coreML": "planned",
      "appleIntelligence": "lyric-assist-planned",
      "scoreCardSharing": true,
      "bridgeVersion": 3,
    ]
  }

  private func selectAudioFile(id: String) {
    let panel = NSOpenPanel()
    panel.title = "Choose audio or video to process locally"
    panel.prompt = "Choose file"
    panel.canChooseDirectories = false
    panel.allowsMultipleSelection = false
    panel.allowedContentTypes = [.audio, .movie, .mpeg4Movie]
    if panel.runModal() == .OK, let url = panel.url {
      respond(id: id, result: ["path": url.path, "name": url.lastPathComponent])
    } else {
      respond(id: id, result: ["cancelled": true])
    }
  }

  private func runWorker(id: String, kind: String, parameters: [String: Any]) {
    let inputPath = parameters["inputPath"] as? String
    let lyrics = parameters["lyrics"] as? String
    emit(name: "surstudio:native-job", detail: ["id": id, "kind": kind, "state": "running"])
    Task {
      do {
        let result = try await worker.run(kind: kind, inputPath: inputPath, lyrics: lyrics)
        respond(id: id, result: result)
        emit(name: "surstudio:native-job", detail: ["id": id, "kind": kind, "state": "complete"])
      } catch {
        respond(id: id, error: error.localizedDescription)
        emit(name: "surstudio:native-job", detail: ["id": id, "kind": kind, "state": "failed", "message": error.localizedDescription])
      }
    }
  }

  private func publishLocalMedia(id: String, parameters: [String: Any]) {
    guard let path = parameters["path"] as? String,
          FileManager.default.isReadableFile(atPath: path) else {
      respond(id: id, error: "The selected local media file is no longer readable.")
      return
    }
    let source = URL(fileURLWithPath: path)
    Task {
      do {
        let published = try await Task.detached(priority: .userInitiated) { () -> [String: String] in
          let applicationSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
          let mediaRoot = applicationSupport.appendingPathComponent("SurStudio/Media", isDirectory: true)
          try FileManager.default.createDirectory(at: mediaRoot, withIntermediateDirectories: true)
          let fileExtension = source.pathExtension.isEmpty ? "audio" : source.pathExtension.lowercased()
          let publishedName = "\(UUID().uuidString).\(fileExtension)"
          let destination = mediaRoot.appendingPathComponent(publishedName)
          try FileManager.default.copyItem(at: source, to: destination)
          return [
            "url": "/api/native-media/\(publishedName)",
            "path": destination.path,
            "name": source.lastPathComponent,
          ]
        }.value
        respond(id: id, result: published)
      } catch {
        respond(id: id, error: "Could not prepare this local file for playback: \(error.localizedDescription)")
      }
    }
  }

  private func shareScoreCard(id: String, parameters: [String: Any]) {
    guard let dataURL = parameters["dataUrl"] as? String,
          dataURL.hasPrefix("data:image/png;base64,"),
          let separator = dataURL.firstIndex(of: ","),
          let data = Data(base64Encoded: String(dataURL[dataURL.index(after: separator)...])),
          data.count <= 12 * 1024 * 1024 else {
      respond(id: id, error: "The generated score card could not be prepared for sharing.")
      return
    }

    do {
      let shareRoot = FileManager.default.temporaryDirectory.appendingPathComponent("SurStudio Share Cards", isDirectory: true)
      try FileManager.default.createDirectory(at: shareRoot, withIntermediateDirectories: true)
      let cardURL = shareRoot.appendingPathComponent("SurStudio-Score-\(UUID().uuidString).png")
      try data.write(to: cardURL, options: .atomic)
      let text = parameters["text"] as? String ?? "My SurStudio karaoke score"
      let items: [Any] = [cardURL, text]
      let destination = parameters["destination"] as? String ?? "picker"

      if destination == "messages", let messages = NSSharingService(named: .composeMessage) {
        messages.perform(withItems: items)
        respond(id: id, result: ["shared": true, "destination": "messages"])
      } else if let webView {
        let picker = NSSharingServicePicker(items: items)
        sharingPicker = picker
        picker.show(relativeTo: webView.bounds, of: webView, preferredEdge: .minY)
        respond(id: id, result: ["shared": true, "destination": "picker"])
      } else {
        try? FileManager.default.removeItem(at: cardURL)
        respond(id: id, error: "The Mac share sheet is unavailable.")
        return
      }

      Task.detached {
        try? await Task.sleep(for: .seconds(900))
        try? FileManager.default.removeItem(at: cardURL)
      }
    } catch {
      respond(id: id, error: "Could not open the Mac share sheet: \(error.localizedDescription)")
    }
  }

  private func respond(id: String, result: [String: Any]? = nil, error: String? = nil) {
    var detail: [String: Any] = ["id": id]
    if let result { detail["result"] = result }
    if let error { detail["error"] = error }
    emit(name: "surstudio:native-response", detail: detail)
  }

  private func emit(name: String, detail: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: detail),
          let json = String(data: data, encoding: .utf8) else { return }
    webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(name)', { detail: \(json) }));")
  }
}
