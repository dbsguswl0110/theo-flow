import AppKit
import SwiftUI

@main
struct TEOCalendarPanelApp: App {
    @NSApplicationDelegateAdaptor(PanelAppDelegate.self) private var delegate

    var body: some Scene {
        Settings { EmptyView() }
    }
}

final class PanelAppDelegate: NSObject, NSApplicationDelegate, NSMenuDelegate {
    private var panel: NSPanel?
    private var statusItem: NSStatusItem?
    private let frameName = "TEOCalendarPanel"
    private let showCompletedKey = "panelShowCompleted"
    private let lastSyncedKey = "panelLastSynced"

    func applicationDidFinishLaunching(_ notification: Notification) {
        UserDefaults.standard.register(defaults: [showCompletedKey: true])
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
        // Come back where it was left (position and size); only the first launch is centred.
        if !panel.setFrameUsingName(frameName) {
            panel.center()
        }
        panel.setFrameAutosaveName(frameName)
        panel.makeKeyAndOrderFront(nil)
        self.panel = panel
        NSApp.activate(ignoringOtherApps: true)
        setUpStatusItem()
    }

    // MARK: Menu bar item (the panel has no Dock icon, menu or close button)

    private func setUpStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = item.button {
            button.image = NSImage(systemSymbolName: "calendar", accessibilityDescription: "TEO 달력 패널")
            if button.image == nil {
                button.title = "TEO"
            }
        }
        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(menuItem("패널 보이기 / 숨기기", #selector(togglePanel)))
        menu.addItem(menuItem("새로고침", #selector(refreshPanel), key: "r"))
        let completed = menuItem("완료 항목 표시", #selector(toggleCompleted))
        completed.tag = 1
        menu.addItem(completed)
        let floating = menuItem("항상 위에 표시", #selector(toggleFloating))
        floating.tag = 2
        menu.addItem(floating)
        menu.addItem(NSMenuItem.separator())
        let synced = NSMenuItem(title: "마지막 동기화 —", action: nil, keyEquivalent: "")
        synced.isEnabled = false
        synced.tag = 3
        menu.addItem(synced)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(menuItem("종료", #selector(quit), key: "q"))
        item.menu = menu
        statusItem = item
    }

    private func menuItem(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
        item.target = self
        return item
    }

    func menuWillOpen(_ menu: NSMenu) {
        let defaults = UserDefaults.standard
        menu.item(withTag: 1)?.state = defaults.bool(forKey: showCompletedKey) ? .on : .off
        menu.item(withTag: 2)?.state = panel?.level == .floating ? .on : .off
        let seconds = defaults.double(forKey: lastSyncedKey)
        let text = seconds > 0
            ? Date(timeIntervalSince1970: seconds).formatted(date: .omitted, time: .shortened)
            : "—"
        menu.item(withTag: 3)?.title = "마지막 동기화 \(text)"
    }

    @objc private func togglePanel() {
        guard let panel else { return }
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.makeKeyAndOrderFront(nil)
        }
    }

    @objc private func refreshPanel() {
        NotificationCenter.default.post(name: .teoPanelRefresh, object: nil)
    }

    @objc private func toggleCompleted() {
        let defaults = UserDefaults.standard
        defaults.set(!defaults.bool(forKey: showCompletedKey), forKey: showCompletedKey)
    }

    @objc private func toggleFloating() {
        guard let panel else { return }
        panel.level = panel.level == .floating ? .normal : .floating
    }

    @objc private func quit() {
        NSApp.terminate(nil)
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
