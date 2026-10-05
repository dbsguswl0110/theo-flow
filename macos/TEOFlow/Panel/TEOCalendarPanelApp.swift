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
        // Only the grip moves the window: the transparent title bar must not drag it either.
        panel.isMovable = false
        panel.isMovableByWindowBackground = false
        // NSPanel hides itself when its app deactivates unless told otherwise; this one stays on the desktop.
        panel.hidesOnDeactivate = false
        panel.isFloatingPanel = true
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
        // The grip lives in the calendar header (PanelCalendarView), next to the buttons.
        PanelCalendarView()
    }
}

struct MoveHandle: NSViewRepresentable {
    func makeNSView(context: Context) -> HandleView {
        HandleView()
    }

    func updateNSView(_ nsView: HandleView, context: Context) {}
}

final class HandleView: NSView {
    private var startMouse: NSPoint = .zero
    private var startOrigin: NSPoint = .zero

    override var mouseDownCanMoveWindow: Bool { false }

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
        startMouse = NSEvent.mouseLocation
        startOrigin = window?.frame.origin ?? .zero
        NSCursor.closedHand.push()
    }

    override func mouseDragged(with event: NSEvent) {
        guard let window else { return }
        // Screen coordinates: window-relative ones shift as the window follows the pointer, which made the old drag jitter.
        let mouse = NSEvent.mouseLocation
        window.setFrameOrigin(NSPoint(x: startOrigin.x + mouse.x - startMouse.x, y: startOrigin.y + mouse.y - startMouse.y))
    }

    override func mouseUp(with event: NSEvent) {
        NSCursor.pop()
    }
}
