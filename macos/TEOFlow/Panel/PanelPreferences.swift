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
    static let plateOpacityKey = "panelPlateOpacity"
    static let defaultPlateOpacity = 0.62
    /// The choices in the menu bar menu, from the clearest glass to the most solid.
    static let plateChoices: [(name: String, opacity: Double)] = [("맑게", 0.4), ("보통", 0.62), ("진하게", 0.86)]
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
