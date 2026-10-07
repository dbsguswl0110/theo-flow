import Foundation

extension Notification.Name {
    /// Posted by the menu bar item to ask the calendar to reload its data.
    static let teoPanelRefresh = Notification.Name("teoPanelRefresh")
}

/// The panel's remembered settings. The menu bar item writes them; the calendar view reads them.
enum PanelPreferences {
    static let showCompletedKey = "panelShowCompleted"
    static let showChecklistKey = "panelShowChecklist"
    /// How much of the height under the header the calendar gets (the rest is the checklist). Dragged by the divider.
    static let calendarShareKey = "panelCalendarShare"
    static let defaultCalendarShare = 0.66
    /// How solid the light plate under the panel's text is. Lower shows more of the wallpaper; higher reads better on busy ones.
    /// The menu bar menu has a slider for it.
    static let plateOpacityKey = "panelPlateOpacity"
    static let defaultPlateOpacity = 0.62
    static let plateRange = 0.2...0.95
    static let frameName = "TEOCalendarPanel"
    private static let lastSyncedKey = "panelLastSynced"

    static func registerDefaults() {
        UserDefaults.standard.register(defaults: [
            showCompletedKey: true, showChecklistKey: true, calendarShareKey: defaultCalendarShare, plateOpacityKey: defaultPlateOpacity,
        ])
    }

    static var showCompleted: Bool {
        get { UserDefaults.standard.bool(forKey: showCompletedKey) }
        set { UserDefaults.standard.set(newValue, forKey: showCompletedKey) }
    }

    static var plateOpacity: Double {
        get { min(max(UserDefaults.standard.double(forKey: plateOpacityKey), plateRange.lowerBound), plateRange.upperBound) }
        set { UserDefaults.standard.set(min(max(newValue, plateRange.lowerBound), plateRange.upperBound), forKey: plateOpacityKey) }
    }

    static var showChecklist: Bool {
        get { UserDefaults.standard.bool(forKey: showChecklistKey) }
        set { UserDefaults.standard.set(newValue, forKey: showChecklistKey) }
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
