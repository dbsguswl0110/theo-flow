import AppKit

/// The menu bar icon that controls the panel. The panel has no Dock icon, menu or close button, so this is its menu.
final class PanelStatusItem: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let panel: NSPanel
    private let completedItem: NSMenuItem
    private let floatingItem: NSMenuItem
    private let syncedItem: NSMenuItem

    init(panel: NSPanel) {
        self.panel = panel
        completedItem = NSMenuItem(title: "완료 항목 표시", action: #selector(PanelStatusItem.toggleCompleted), keyEquivalent: "")
        floatingItem = NSMenuItem(title: "항상 위에 표시", action: #selector(PanelStatusItem.toggleFloating), keyEquivalent: "")
        syncedItem = NSMenuItem(title: "마지막 동기화 —", action: nil, keyEquivalent: "")
        super.init()

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "calendar", accessibilityDescription: "TEO 달력 패널")
            if button.image == nil {
                button.title = "TEO"
            }
        }

        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(item("패널 보이기 / 숨기기", #selector(PanelStatusItem.togglePanel)))
        menu.addItem(item("새로고침", #selector(PanelStatusItem.refresh), key: "r"))
        completedItem.target = self
        menu.addItem(completedItem)
        floatingItem.target = self
        menu.addItem(floatingItem)
        menu.addItem(NSMenuItem.separator())
        syncedItem.isEnabled = false
        menu.addItem(syncedItem)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(item("종료", #selector(PanelStatusItem.quit), key: "q"))
        statusItem.menu = menu
    }

    private func item(_ title: String, _ action: Selector, key: String = "") -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.target = self
        return menuItem
    }

    // The check marks and the sync time are refreshed each time the menu opens.
    func menuWillOpen(_ menu: NSMenu) {
        completedItem.state = PanelPreferences.showCompleted ? .on : .off
        floatingItem.state = panel.level == .floating ? .on : .off
        let time = PanelPreferences.lastSynced?.formatted(date: .omitted, time: .shortened) ?? "—"
        syncedItem.title = "마지막 동기화 \(time)"
    }

    @objc private func togglePanel() {
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.makeKeyAndOrderFront(nil)
        }
    }

    @objc private func refresh() {
        NotificationCenter.default.post(name: .teoPanelRefresh, object: nil)
    }

    @objc private func toggleCompleted() {
        PanelPreferences.showCompleted.toggle()
    }

    @objc private func toggleFloating() {
        panel.level = panel.level == .floating ? .normal : .floating
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
