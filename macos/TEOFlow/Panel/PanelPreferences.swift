import Foundation

extension Notification.Name {
    /// Posted by the menu bar item to ask the calendar to reload its data.
    static let teoPanelRefresh = Notification.Name("teoPanelRefresh")
}

/// The panel's remembered settings. The menu bar item writes them; the calendar view reads them.
enum PanelPreferences {
    static let showCompletedKey = "panelShowCompleted"
    static let frameName = "TEOCalendarPanel"
    private static let lastSyncedKey = "panelLastSynced"

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [showCompletedKey: true])
    }

    static var showCompleted: Bool {
        get { UserDefaults.standard.bool(forKey: showCompletedKey) }
        set { UserDefaults.standard.set(newValue, forKey: showCompletedKey) }
    }

    /// When data last arrived from the server; nil if it never has.
    static var lastSynced: Date? {
        get {
            let seconds = UserDefaults.standard.double(forKey: lastSyncedKey)
            return seconds > 0 ? Date(timeIntervalSince1970: seconds) : nil
        }
        set { UserDefaults.standard.set(newValue?.timeIntervalSince1970 ?? 0, forKey: lastSyncedKey) }
    }
}
