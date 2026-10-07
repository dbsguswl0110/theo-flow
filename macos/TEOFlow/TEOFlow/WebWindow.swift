import AppKit
import WebKit

/// The TEO web app in its own window. Closing the window only hides it; the panel and the menu bar icon stay.
@MainActor
final class WebWindow: NSObject, WKNavigationDelegate {
    private static let url = URL(string: "https://theo-flow.dbsguswl0110.workers.dev/")!
    private static let frameName = "TEOWebWindow"

    private var window: NSWindow?
    private var webView: WKWebView?
    private var isReady = false
    private var pendingMode: String?

    /// Brings the window to the front, making it first if needed. A link ("calendar", "note", ...) opens that screen.
    func show(link mode: String? = nil) {
        let window = window ?? makeWindow()
        if let mode, !mode.isEmpty {
            pendingMode = mode
            dispatchPendingIfReady()
        }
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func makeWindow() -> NSWindow {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        // The web app looks for this word to open on the calendar and leave the phone's swipe pad out.
        configuration.applicationNameForUserAgent = "TEOFlowMac"
        let view = WKWebView(frame: .zero, configuration: configuration)
        view.allowsBackForwardNavigationGestures = true
        view.setValue(false, forKey: "drawsBackground")
        view.navigationDelegate = self
        view.load(URLRequest(url: Self.url, cachePolicy: .reloadIgnoringLocalCacheData))

        let window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1000, height: 720),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "TEO"
        window.contentView = view
        window.isReleasedWhenClosed = false
        window.minSize = NSSize(width: 520, height: 560)
        if !window.setFrameUsingName(Self.frameName) {
            window.center()
        }
        window.setFrameAutosaveName(Self.frameName)
        self.window = window
        self.webView = view
        return window
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        isReady = true
        dispatchPendingIfReady()
    }

    private func dispatchPendingIfReady() {
        guard isReady, let mode = pendingMode, let webView else { return }
        pendingMode = nil
        let escaped = mode.replacingOccurrences(of: "'", with: "")
        webView.evaluateJavaScript("window.dispatchEvent(new CustomEvent('theo-widget-open',{detail:'\(escaped)'}));")
    }
}
