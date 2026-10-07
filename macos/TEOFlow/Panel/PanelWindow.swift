import AppKit
import SwiftUI

/// A hosting view that takes the click that lands on it even while another app is in front,
/// so the panel's buttons work on the first click without the app having to come forward.
final class FirstMouseHostingView<Content: View>: NSHostingView<Content> {
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}

/// The glass window that holds the calendar and the checklist. It lives on the desktop, not above other windows.
enum PanelWindow {
    /// Tall enough for a month with two bars under each day and a few checklist rows below it.
    static let defaultSize = NSSize(width: 470, height: 600)
    /// Small enough to tuck away, tall enough for a month with a bar under each day and a couple of checklist rows.
    static let minimumSize = NSSize(width: 330, height: 400)

    static func make<Content: View>(content: Content) -> NSPanel {
        let panel = NSPanel(
            contentRect: NSRect(origin: .zero, size: defaultSize),
            // Never activating: clicking the panel must not bring the app, or anything else, in front of other windows.
            styleMask: [.titled, .resizable, .fullSizeContentView, .nonactivatingPanel],
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
        panel.isFloatingPanel = false
        panel.becomesKeyOnlyIfNeeded = true
        // The layer of the desktop icons (one above, so the panel is over the icons it is placed beside).
        // Every window of every app is above that, however the panel was last clicked.
        panel.level = NSWindow.Level(rawValue: Int(CGWindowLevelForKey(.desktopIconWindow)) + 1)
        // On every Space, and staying put when windows are swept aside to show the desktop.
        panel.collectionBehavior = [.canJoinAllSpaces, .stationary, .ignoresCycle]
        panel.minSize = minimumSize
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        panel.contentView = FirstMouseHostingView(rootView: content)

        // Come back where it was left (position and size); the first launch is the top right corner of the screen.
        if !panel.setFrameUsingName(PanelPreferences.frameName) {
            if let area = NSScreen.main?.visibleFrame {
                panel.setFrameOrigin(NSPoint(x: area.maxX - defaultSize.width - 24, y: area.maxY - defaultSize.height - 24))
            } else {
                panel.center()
            }
        }
        panel.setFrameAutosaveName(PanelPreferences.frameName)
        return panel
    }
}
