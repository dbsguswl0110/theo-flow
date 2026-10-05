import SwiftUI
import WebKit

/// One widget tap. The id makes repeated taps on the same link distinct events.
struct DeepLink: Equatable {
    let id = UUID()
    let mode: String
}

@main
struct TEOFlowApp: App {
    @State private var deepLink: DeepLink?

    var body: some Scene {
        // A single window: widget links reuse it instead of opening another copy of the app.
        Window("TEO Flow", id: "main") {
            WebContainer(
                url: URL(string: "https://theo-flow.dbsguswl0110.workers.dev/")!,
                deepLink: deepLink
            )
                .frame(minWidth: 420, minHeight: 680)
                .onOpenURL { url in
                    let mode = url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    deepLink = DeepLink(mode: mode)
                }
        }
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}

struct WebContainer: NSViewRepresentable {
    let url: URL
    let deepLink: DeepLink?

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.allowsBackForwardNavigationGestures = true
        view.setValue(false, forKey: "drawsBackground")
        view.navigationDelegate = context.coordinator
        context.coordinator.webView = view
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        context.coordinator.webView = view
        // Compare link ids, not modes: tapping the same widget link twice must navigate twice.
        if let deepLink, !deepLink.mode.isEmpty, context.coordinator.lastLinkID != deepLink.id {
            context.coordinator.lastLinkID = deepLink.id
            context.coordinator.pendingMode = deepLink.mode
            context.coordinator.dispatchPendingIfReady()
        }
        guard view.url?.host != url.host else { return }
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: WKWebView?
        var lastLinkID: UUID?
        var pendingMode: String?
        var isReady = false

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            isReady = true
            dispatchPendingIfReady()
        }

        func dispatchPendingIfReady() {
            guard isReady, let mode = pendingMode, let webView else { return }
            pendingMode = nil
            let escaped = mode.replacingOccurrences(of: "'", with: "")
            webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('theo-widget-open',{detail:'\(escaped)'}));")
        }
    }
}
