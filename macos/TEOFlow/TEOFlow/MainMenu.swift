import AppKit

/// The app has no menu bar of its own (no Dock icon), but the keyboard shortcuts still come from a main menu:
/// without an Edit menu, copy and paste would not work in the web view.
@MainActor
enum MainMenu {
    static func make() -> NSMenu {
        let main = NSMenu()

        func entry(_ title: String, _ action: Selector, _ key: String, _ modifiers: NSEvent.ModifierFlags = .command) -> NSMenuItem {
            let item = NSMenuItem(title: title, action: action, keyEquivalent: key)
            item.keyEquivalentModifierMask = modifiers
            return item
        }
        func add(_ title: String, _ items: [NSMenuItem]) {
            let bar = NSMenuItem()
            let menu = NSMenu(title: title)
            items.forEach { menu.addItem($0) }
            bar.submenu = menu
            main.addItem(bar)
        }

        add("TEO", [entry("TEO 종료", #selector(NSApplication.terminate(_:)), "q")])
        add("편집", [
            entry("실행 취소", Selector(("undo:")), "z"),
            entry("다시 실행", Selector(("redo:")), "z", [.command, .shift]),
            NSMenuItem.separator(),
            entry("잘라내기", #selector(NSText.cut(_:)), "x"),
            entry("복사", #selector(NSText.copy(_:)), "c"),
            entry("붙여넣기", #selector(NSText.paste(_:)), "v"),
            entry("모두 선택", #selector(NSText.selectAll(_:)), "a"),
        ])
        add("보기", [entry("새로고침", Selector(("reload:")), "r")])
        add("창", [
            entry("닫기", #selector(NSWindow.performClose(_:)), "w"),
            entry("최소화", #selector(NSWindow.performMiniaturize(_:)), "m"),
        ])
        return main
    }
}
