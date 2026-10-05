import AppKit
import SwiftUI

@main
struct TEOCalendarPanelApp: App {
    @NSApplicationDelegateAdaptor(PanelAppDelegate.self) private var delegate

    // The panel is an AppKit window made in PanelWindow; SwiftUI only needs a scene to launch.
    var body: some Scene {
        Settings { EmptyView() }
    }
}

final class PanelAppDelegate: NSObject, NSApplicationDelegate {
    private var panel: NSPanel?
    private var statusItem: PanelStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        PanelPreferences.registerDefaults()
        let panel = PanelWindow.make(content: PanelCalendarView())
        panel.makeKeyAndOrderFront(nil)
        self.panel = panel
        statusItem = PanelStatusItem(panel: panel)
        NSApp.activate(ignoringOtherApps: true)
    }

    // Hiding the panel from the menu bar item must not end the app.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
