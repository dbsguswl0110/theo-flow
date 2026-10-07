import AppKit
import ServiceManagement

/// The menu bar icon: always there, and the way to open the web window, show or hide the panel and quit.
@MainActor
final class AppStatusItem: NSObject, NSMenuDelegate {
    private let statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private let panel: NSPanel
    private let web: WebWindow
    private let completedItem: NSMenuItem
    private let checklistItem: NSMenuItem
    private let loginItem: NSMenuItem
    private let syncedItem: NSMenuItem

    init(panel: NSPanel, web: WebWindow) {
        self.panel = panel
        self.web = web
        completedItem = NSMenuItem(title: "완료 항목 표시", action: #selector(AppStatusItem.toggleCompleted), keyEquivalent: "")
        checklistItem = NSMenuItem(title: "할 일 목록 표시", action: #selector(AppStatusItem.toggleChecklist), keyEquivalent: "")
        loginItem = NSMenuItem(title: "로그인할 때 열기", action: #selector(AppStatusItem.toggleLogin), keyEquivalent: "")
        syncedItem = NSMenuItem(title: "마지막 동기화 —", action: nil, keyEquivalent: "")
        super.init()

        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "calendar", accessibilityDescription: "TEO")
            if button.image == nil {
                button.title = "TEO"
            }
        }

        let menu = NSMenu()
        menu.delegate = self
        menu.addItem(item("TEO 열기", #selector(AppStatusItem.openWeb)))
        menu.addItem(item("바탕화면 패널 보이기 / 숨기기", #selector(AppStatusItem.togglePanel)))
        menu.addItem(item("패널 새로고침", #selector(AppStatusItem.refresh)))
        menu.addItem(NSMenuItem.separator())
        completedItem.target = self
        menu.addItem(completedItem)
        checklistItem.target = self
        menu.addItem(checklistItem)
        loginItem.target = self
        menu.addItem(loginItem)
        menu.addItem(NSMenuItem.separator())
        syncedItem.isEnabled = false
        menu.addItem(syncedItem)
        menu.addItem(NSMenuItem.separator())
        menu.addItem(item("종료", #selector(AppStatusItem.quit), key: "q"))
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
        checklistItem.state = PanelPreferences.showChecklist ? .on : .off
        switch SMAppService.mainApp.status {
        case .enabled: loginItem.state = .on
        case .requiresApproval: loginItem.state = .mixed
        default: loginItem.state = .off
        }
        let time = PanelPreferences.lastSynced?.formatted(date: .omitted, time: .shortened) ?? "—"
        syncedItem.title = "마지막 동기화 \(time)"
    }

    @objc private func openWeb() {
        web.show()
    }

    @objc private func togglePanel() {
        if panel.isVisible {
            panel.orderOut(nil)
        } else {
            panel.orderFront(nil)
        }
    }

    @objc private func refresh() {
        NotificationCenter.default.post(name: .teoPanelRefresh, object: nil)
    }

    @objc private func toggleCompleted() {
        PanelPreferences.showCompleted.toggle()
    }

    @objc private func toggleChecklist() {
        PanelPreferences.showChecklist.toggle()
    }

    // Turns "open TEO when I log in" on or off. macOS may ask the user to approve it once in System Settings.
    @objc private func toggleLogin() {
        let service = SMAppService.mainApp
        do {
            if service.status == .enabled {
                try service.unregister()
            } else {
                try service.register()
                if service.status == .requiresApproval {
                    SMAppService.openSystemSettingsLoginItems()
                }
            }
        } catch {
            NSApp.activate(ignoringOtherApps: true)
            let alert = NSAlert()
            alert.messageText = "로그인할 때 열기를 바꾸지 못했어요"
            alert.informativeText = "시스템 설정 → 일반 → 로그인 항목에서 직접 켜고 끌 수 있어요.\n\(error.localizedDescription)"
            alert.runModal()
        }
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }
}
