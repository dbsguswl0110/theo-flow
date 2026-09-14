import SwiftUI
import WebKit

@main
struct TEOFlowApp: App {
    @State private var deepLinkMode: String?

    var body: some Scene {
        WindowGroup {
            WebContainer(
                url: URL(string: "https://theo-flow.dbsguswl0110.workers.dev/")!,
                deepLinkMode: deepLinkMode
            )
                .frame(minWidth: 420, minHeight: 680)
                .onOpenURL { url in
                    let mode = url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
                    deepLinkMode = mode == "new-note" ? "note" : mode
                }
        }
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}

struct WebContainer: NSViewRepresentable {
    let url: URL
    let deepLinkMode: String?

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
        if let deepLinkMode, !deepLinkMode.isEmpty, context.coordinator.lastMode != deepLinkMode {
            context.coordinator.lastMode = deepLinkMode
            context.coordinator.pendingMode = deepLinkMode
            context.coordinator.dispatchPendingIfReady()
        }
        guard view.url?.host != url.host else { return }
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }

    final class Coordinator: NSObject, WKNavigationDelegate {
        weak var webView: WKWebView?
        var lastMode: String?
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
