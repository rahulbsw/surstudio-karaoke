import AppKit
import SwiftUI
import WebKit

struct SurStudioWebView: NSViewRepresentable {
  let url: URL

  func makeCoordinator() -> Coordinator { Coordinator() }

  func makeNSView(context: Context) -> WKWebView {
    let configuration = WKWebViewConfiguration()
    configuration.defaultWebpagePreferences.allowsContentJavaScript = true
    configuration.mediaTypesRequiringUserActionForPlayback = []
    configuration.allowsAirPlayForMediaPlayback = true
    configuration.userContentController.add(context.coordinator.bridge, name: "surstudio")
    configuration.userContentController.addUserScript(WKUserScript(
      source: "window.__SURSTUDIO_MAC__ = true; document.documentElement.dataset.surstudioMac = 'true';",
      injectionTime: .atDocumentStart,
      forMainFrameOnly: true
    ))

    let webView = WKWebView(frame: .zero, configuration: configuration)
    webView.navigationDelegate = context.coordinator
    webView.uiDelegate = context.coordinator
    webView.allowsMagnification = true
    webView.setValue(false, forKey: "drawsBackground")
    context.coordinator.bridge.attach(to: webView)
    webView.load(URLRequest(url: url))
    return webView
  }

  func updateNSView(_ webView: WKWebView, context: Context) {
    guard webView.url != url else { return }
    webView.load(URLRequest(url: url))
  }

  @MainActor
  final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate {
    let bridge = NativeBridge()

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping @MainActor @Sendable (WKNavigationActionPolicy) -> Void) {
      guard navigationAction.targetFrame?.isMainFrame != false,
            navigationAction.navigationType == .linkActivated,
            let target = navigationAction.request.url,
            target.host != "127.0.0.1" else {
        decisionHandler(.allow)
        return
      }
      NSWorkspace.shared.open(target)
      decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
      if let target = navigationAction.request.url { NSWorkspace.shared.open(target) }
      return nil
    }

    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping @MainActor @Sendable (WKPermissionDecision) -> Void) {
      decisionHandler(origin.host == "127.0.0.1" && type == .microphone ? .grant : .deny)
    }
  }
}
