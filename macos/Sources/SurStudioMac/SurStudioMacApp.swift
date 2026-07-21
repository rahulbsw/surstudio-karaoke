import AppKit
import SwiftUI

@main
struct SurStudioMacApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
  @StateObject private var model = AppModel()

  var body: some Scene {
    WindowGroup {
      RootView()
        .environmentObject(model)
        .frame(minWidth: 980, minHeight: 700)
        .task { await model.start() }
    }
    .defaultSize(width: 1280, height: 860)
    .windowStyle(.hiddenTitleBar)
    .commands {
      CommandGroup(replacing: .newItem) { }
    }
  }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
  func applicationWillTerminate(_ notification: Notification) {
    LocalWebServer.shared.stop()
  }
}

struct RootView: View {
  @EnvironmentObject private var model: AppModel

  var body: some View {
    Group {
      switch model.state {
      case .idle, .starting:
        VStack(spacing: 14) {
          ProgressView()
            .controlSize(.large)
          Text("Preparing SurStudio")
            .font(.headline)
          Text("Starting the private local karaoke service…")
            .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.035, green: 0.035, blue: 0.065))
      case .ready(let url):
        SurStudioWebView(url: url)
      case .failed(let message):
        VStack(spacing: 16) {
          Image(systemName: "waveform.badge.exclamationmark")
            .font(.system(size: 42))
            .foregroundStyle(.purple)
          Text("SurStudio could not start")
            .font(.title2.bold())
          Text(message)
            .multilineTextAlignment(.center)
            .foregroundStyle(.secondary)
            .frame(maxWidth: 520)
          Button("Try again") { Task { await model.start(forceRestart: true) } }
            .buttonStyle(.borderedProminent)
            .tint(.purple)
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.035, green: 0.035, blue: 0.065))
      }
    }
    .preferredColorScheme(.dark)
  }
}
