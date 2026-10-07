import AppKit

/// TEO is one app with no Dock icon: a menu bar icon, the web app in a window (the calendar first)
/// and the calendar panel on the desktop. AppKit starts it directly so the menus and windows are all ours.
@main
@MainActor
enum TEOMain {
    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        // The delegate is held weakly by NSApplication, so keep it alive for as long as the app runs.
        withExtendedLifetime(delegate) { app.run() }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private let web = WebWindow()
    private var panel: NSPanel?
    private var statusItem: AppStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Info.plist says the same (LSUIElement); this keeps it true if the app is ever started another way.
        NSApp.setActivationPolicy(.accessory)
        NSApp.mainMenu = MainMenu.make()
        PanelPreferences.registerDefaults()
        let panel = PanelWindow.make(content: PanelCalendarView())
        panel.orderFront(nil)
        self.panel = panel
        statusItem = AppStatusItem(panel: panel, web: web)
        // Started by macOS at login: only the panel, so the web window does not pop up every morning.
        if !Self.launchedAtLogin {
            web.show()
        }
    }

    /// True when this launch is macOS opening the app as a login item. Only valid while the app is finishing launching.
    private static var launchedAtLogin: Bool {
        let event = NSAppleEventManager.shared().currentAppleEvent
        return event?.eventID == kAEOpenApplication
            && event?.paramDescriptor(forKeyword: keyAEPropData)?.enumCodeValue == keyAELaunchedAsLogInItem
    }

    // Widget links: teoflow://calendar, teoflow://note, teoflow://new-note ...
    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls where url.scheme == "teoflow" {
            let mode = url.host ?? url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
            web.show(link: mode)
        }
    }

    // Opening TEO again (Finder, Spotlight) brings the web window back.
    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        web.show()
        return false
    }

    // Closing the web window must not end the app: the panel stays on the desktop.
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        false
    }
}
