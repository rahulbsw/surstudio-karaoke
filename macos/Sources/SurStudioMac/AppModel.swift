import Foundation

@MainActor
final class AppModel: ObservableObject {
  enum State {
    case idle
    case starting
    case ready(URL)
    case failed(String)
  }

  @Published var state: State = .idle

  func start(forceRestart: Bool = false) async {
    guard forceRestart || !isStartingOrReady else { return }
    state = .starting
    do {
      let url = try await LocalWebServer.shared.start(forceRestart: forceRestart)
      state = .ready(url)
    } catch {
      state = .failed(error.localizedDescription)
    }
  }

  private var isStartingOrReady: Bool {
    switch state {
    case .starting, .ready: true
    default: false
    }
  }
}
