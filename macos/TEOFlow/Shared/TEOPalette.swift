import SwiftUI

/// Colours the widget and the panel have in common. Todo is orange and Task is teal, as on the web calendar.
enum TEOPalette {
    static let ink = Color(red: 0.29, green: 0.20, blue: 0.15)
    static let inkSoft = Color(red: 0.36, green: 0.26, blue: 0.20)
    static let muted = Color(red: 0.44, green: 0.32, blue: 0.25)
    static let accent = Color(red: 0.53, green: 0.36, blue: 0.26)
    static let today = Color(red: 0.80, green: 0.17, blue: 0.14)
    /// The red for small text (a late item, Sunday): darker than the big red of today's number, so it reads on a light plate.
    static let alert = Color(red: 0.70, green: 0.12, blue: 0.10)
    static let todo = Color(red: 0.78, green: 0.41, blue: 0.24)
    static let task = Color(red: 0.31, green: 0.49, blue: 0.49)

    static func color(for item: CalendarItem) -> Color {
        item.isTask ? task : todo
    }
}
