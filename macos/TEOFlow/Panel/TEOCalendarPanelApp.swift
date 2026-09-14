import AppKit
import SwiftUI

@main
struct TEOCalendarPanelApp: App {
    @NSApplicationDelegateAdaptor(PanelAppDelegate.self) private var delegate

    var body: some Scene {
        Settings { EmptyView() }
    }
}

final class PanelAppDelegate: NSObject, NSApplicationDelegate {
    private var panel: NSPanel?

    func applicationDidFinishLaunching(_ notification: Notification) {
        let frame = NSRect(x: 120, y: 640, width: 470, height: 430)
        let panel = NSPanel(
            contentRect: frame,
            styleMask: [.titled, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )
        panel.title = "TEO Calendar"
        panel.titleVisibility = .hidden
        panel.titlebarAppearsTransparent = true
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = true
        panel.isMovableByWindowBackground = false
        panel.level = .floating
        panel.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        panel.minSize = NSSize(width: 330, height: 280)
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true

        let content = PanelRootView()
        panel.contentView = NSHostingView(rootView: content)
        panel.center()
        panel.makeKeyAndOrderFront(nil)
        self.panel = panel
        NSApp.activate(ignoringOtherApps: true)
    }
}

struct PanelRootView: View {
    var body: some View {
        ZStack(alignment: .topTrailing) {
            PanelCalendarView()
            MoveHandle()
                .frame(width: 28, height: 28)
                .padding(9)
                .contentShape(Rectangle())
        }
    }
}

struct MoveHandle: NSViewRepresentable {
    func makeNSView(context: Context) -> HandleView {
        HandleView()
    }

    func updateNSView(_ nsView: HandleView, context: Context) {}
}

final class HandleView: NSView {
    private var startPoint: NSPoint = .zero
    private var startOrigin: NSPoint = .zero

    override func draw(_ dirtyRect: NSRect) {
        // Keep the grip visible against both light and dark desktop backgrounds.
        // This is the only draggable area in the panel.
        NSColor(calibratedWhite: 1, alpha: 0.2).setFill()
        NSBezierPath(roundedRect: bounds.insetBy(dx: 1, dy: 1), xRadius: 7, yRadius: 7).fill()

        NSColor(calibratedWhite: 0.18, alpha: 0.5).setFill()
        let dot: CGFloat = 2.2
        for row in 0..<3 {
            for column in 0..<2 {
                let x = bounds.midX - 4 + CGFloat(column) * 7
                let y = bounds.midY - 6 + CGFloat(row) * 6
                NSBezierPath(ovalIn: NSRect(x: x, y: y, width: dot, height: dot)).fill()
            }
        }
    }

    override func resetCursorRects() {
        addCursorRect(bounds, cursor: .openHand)
    }

    override func mouseDown(with event: NSEvent) {
        startPoint = event.locationInWindow
        startOrigin = window?.frame.origin ?? .zero
        NSCursor.closedHand.push()
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window else { return }
        let current = event.locationInWindow
        window.setFrameOrigin(NSPoint(x: startOrigin.x + current.x - startPoint.x, y: startOrigin.y + current.y - startPoint.y))
    }

    override func mouseUp(with event: NSEvent) {
        NSCursor.pop()
    }
}
