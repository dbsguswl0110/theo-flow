import SwiftUI
import WebKit

@main
struct TEOFlowApp: App {
    var body: some Scene {
        WindowGroup {
            WebContainer(url: URL(string: "https://theo-flow.dbsguswl0110.workers.dev/")!)
                .frame(minWidth: 420, minHeight: 680)
        }
        .commands {
            CommandGroup(replacing: .newItem) {}
        }
    }
}

struct WebContainer: NSViewRepresentable {
    let url: URL

    func makeNSView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.allowsBackForwardNavigationGestures = true
        view.setValue(false, forKey: "drawsBackground")
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateNSView(_ view: WKWebView, context: Context) {
        guard view.url?.host != url.host else { return }
        view.load(URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData))
    }
}
