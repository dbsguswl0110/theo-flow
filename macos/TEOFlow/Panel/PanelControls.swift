import AppKit
import SwiftUI

/// The dotted grip that moves the window. It is the only draggable part of the panel.
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
    // The grip works on the first click even when the panel is not the active window.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }

    override func draw(_ dirtyRect: NSRect) {
        // Keep the grip visible against both light and dark desktop backgrounds.
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
        // Screen coordinates: window-relative ones shift as the window follows the pointer, which made the drag jitter.
        let mouse = NSEvent.mouseLocation
        window.setFrameOrigin(NSPoint(x: startOrigin.x + mouse.x - startMouse.x, y: startOrigin.y + mouse.y - startMouse.y))
    }

    override func mouseUp(with event: NSEvent) {
        NSCursor.pop()
    }
}

/// The blurred glass behind the calendar.
struct PanelVisualEffect: NSViewRepresentable {
    func makeNSView(context: Context) -> NSVisualEffectView {
        let view = NSVisualEffectView()
        view.material = .hudWindow
        view.blendingMode = .behindWindow
        view.state = .active
        return view
    }

    func updateNSView(_ nsView: NSVisualEffectView, context: Context) {}
}

struct PanelPillButtonStyle: ButtonStyle {
    let compact: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 9 : 10, weight: .semibold, design: .rounded))
            .foregroundStyle(Color(red: 0.42, green: 0.29, blue: 0.22))
            .padding(.horizontal, compact ? 7 : 9)
            .frame(minHeight: compact ? 22 : 26)
            .background(Color.white.opacity(configuration.isPressed ? 0.3 : 0.44), in: Capsule())
    }
}

struct PanelIconButtonStyle: ButtonStyle {
    let compact: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: compact ? 13 : 16, weight: .semibold, design: .rounded))
            .foregroundStyle(Color(red: 0.42, green: 0.29, blue: 0.22))
            .frame(width: compact ? 24 : 28, height: compact ? 22 : 26)
            .background(Color.white.opacity(configuration.isPressed ? 0.3 : 0.44), in: Capsule())
    }
}
