import AppKit
import SwiftUI

/// The floating glass window that holds the calendar.
enum PanelWindow {
    /// Tall enough for a month with two bars under each day and a few checklist rows below it.
    static let defaultSize = NSSize(width: 470, height: 600)
    /// Small enough to tuck away, tall enough for a month with a bar under each day and a couple of checklist rows.
    static let minimumSize = NSSize(width: 330, height: 400)

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
        growForChecklist(panel)
        panel.setFrameAutosaveName(PanelPreferences.frameName)
        return panel
    }

    /// A window saved before the checklist existed is too short for it. Grow it once, keeping its top edge;
    /// after that the size is the user's to change.
    private static func growForChecklist(_ panel: NSPanel) {
        let defaults = UserDefaults.standard
        guard defaults.integer(forKey: PanelPreferences.layoutVersionKey) < PanelPreferences.layoutVersion else { return }
        defaults.set(PanelPreferences.layoutVersion, forKey: PanelPreferences.layoutVersionKey)
        var frame = panel.frame
        guard frame.height < defaultSize.height else { return }
        frame.origin.y -= defaultSize.height - frame.height
        frame.size.height = defaultSize.height
        panel.setFrame(panel.constrainFrameRect(frame, to: panel.screen), display: false)
    }
}
