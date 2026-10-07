import CoreGraphics
import Foundation

// Lists the windows of an app with the layer each one sits on, so a build can show where TEO's windows are.
//   swift macos/tools/windows.swift TEO
let owner = CommandLine.arguments.dropFirst().first ?? "TEO"
let level = { (key: CGWindowLevelKey) in CGWindowLevelForKey(key) }
print("levels: desktop=\(level(.desktopWindow)) desktopIcon=\(level(.desktopIconWindow)) normal=\(level(.normalWindow)) floating=\(level(.floatingWindow)) statusBar=\(level(.statusWindow))")
let windows = CGWindowListCopyWindowInfo([.optionAll], kCGNullWindowID) as? [[String: Any]] ?? []
for window in windows where (window[kCGWindowOwnerName as String] as? String ?? "").contains(owner) {
    let layer = window[kCGWindowLayer as String] as? Int ?? 0
    let onScreen = window[kCGWindowIsOnscreen as String] as? Bool ?? false
    let bounds = window[kCGWindowBounds as String] as? [String: Any] ?? [:]
    let size = "\(bounds["Width"] ?? "?")x\(bounds["Height"] ?? "?")"
    print("layer=\(layer) onscreen=\(onScreen) size=\(size) owner=\(window[kCGWindowOwnerName as String] ?? "")")
}
