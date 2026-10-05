import AppKit
import SwiftUI

/// The floating glass window that holds the calendar.
enum PanelWindow {
    static let defaultSize = NSSize(width: 470, height: 430)
    /// Small enough to tuck away, tall enough that a six-week month still has a lane under every day number.
    static let minimumSize = NSSize(width: 330, height: 320)

    static func make<Content: View>(content: Content) -> NSPanel {
        let panel = NSPanel(
            contentRect: NSRect(origin: NSPoint(x: 120, y: 640), size: defaultSize),
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
        panel.minSize = minimumSize
        panel.standardWindowButton(.closeButton)?.isHidden = true
        panel.standardWindowButton(.miniaturizeButton)?.isHidden = true
        panel.standardWindowButton(.zoomButton)?.isHidden = true
        panel.contentView = NSHostingView(rootView: content)

        // Come back where it was left (position and size); only the first launch is centred.
        if !panel.setFrameUsingName(PanelPreferences.frameName) {
            panel.center()
        }
        panel.setFrameAutosaveName(PanelPreferences.frameName)
        return panel
    }
}
